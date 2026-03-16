import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { Role } from "./roles.enum";
import { AuthContext } from "../common/interfaces/auth-context.interface";
import { CreateUserDto } from "./dto/create-user.dto";
import { AppLoggerService } from "../logging/app-logger.service";

@Injectable()
export class IamService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSystemAdmin();
  }

  async createCompany(name: string) {
    return this.prisma.company.create({ data: { name } });
  }

  async listCompanies(auth: AuthContext) {
    if (auth.role === Role.SYSTEM_ADMIN) {
      return this.prisma.company.findMany({ orderBy: { createdAt: "desc" } });
    }

    if (!auth.companyId) {
      return [];
    }
    const company = await this.prisma.company.findUnique({ where: { id: auth.companyId } });
    return company ? [company] : [];
  }

  async createUser(auth: AuthContext, payload: CreateUserDto) {
    this.assertCreateUserPolicy(auth, payload);

    const targetCompanyId =
      auth.role === Role.COMPANY_ADMIN ? auth.companyId : payload.companyId ?? null;

    if (payload.role !== Role.SYSTEM_ADMIN && !targetCompanyId) {
      throw new BadRequestException("companyId is required for non-system-admin users");
    }

    if (payload.role === Role.SYSTEM_ADMIN && auth.role !== Role.SYSTEM_ADMIN) {
      this.logCompanyBoundaryViolation(auth, "create_system_admin");
      throw new ForbiddenException("Only system admin can create system admins");
    }

    if (payload.role !== Role.SYSTEM_ADMIN && targetCompanyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: targetCompanyId },
        select: { id: true },
      });
      if (!company) {
        throw new BadRequestException("Invalid companyId");
      }
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });
    if (existing) {
      throw new BadRequestException("Email already exists");
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    try {
      return await this.prisma.user.create({
        data: {
          email: payload.email.toLowerCase(),
          passwordHash,
          role: payload.role,
          companyId: targetCompanyId,
        },
        select: {
          id: true,
          email: true,
          role: true,
          companyId: true,
          createdAt: true,
        },
      });
    } catch (error: unknown) {
      if (this.isPrismaForeignKeyViolation(error)) {
        throw new BadRequestException("Invalid companyId");
      }
      throw error;
    }
  }

  async listUsers(auth: AuthContext) {
    if (auth.role === Role.SYSTEM_ADMIN) {
      return this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          companyId: true,
          createdAt: true,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!auth.companyId) {
      return [];
    }
    return this.prisma.user.findMany({
      where: {
        companyId: auth.companyId,
        role: { not: Role.SYSTEM_ADMIN },
      },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        createdAt: true,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateUserRole(auth: AuthContext, userId: string, role: Role) {
    if (auth.role !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException("Only system admin can update roles");
    }

    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        role,
        companyId: role === Role.SYSTEM_ADMIN ? null : existing.companyId,
      },
      select: { id: true, email: true, role: true, companyId: true, updatedAt: true },
    });
  }

  async setDevicePermissions(auth: AuthContext, userId: string, sensorIds: string[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (auth.role === Role.COMPANY_ADMIN) {
      if (!auth.companyId || user.companyId !== auth.companyId) {
        this.logCompanyBoundaryViolation(auth, "manage_user_outside_company", {
          targetUserId: userId,
        });
        throw new ForbiddenException("You can manage users only in your company");
      }
    } else if (auth.role !== Role.SYSTEM_ADMIN) {
      throw new ForbiddenException("Insufficient role permissions");
    }

    const sensors = await this.prisma.sensor.findMany({ where: { id: { in: sensorIds } } });
    if (sensors.length !== sensorIds.length) {
      throw new BadRequestException("One or more sensors do not exist");
    }

    if (auth.role === Role.COMPANY_ADMIN) {
      const invalid = sensors.some((sensor) => sensor.companyId !== auth.companyId);
      if (invalid) {
        this.logCompanyBoundaryViolation(auth, "assign_sensor_outside_company", {
          targetUserId: userId,
        });
        throw new ForbiddenException("Cannot assign sensors from another company");
      }
    }

    await this.prisma.userDevicePermission.deleteMany({ where: { userId } });
    await this.prisma.userDevicePermission.createMany({
      data: sensorIds.map((sensorId) => ({ userId, sensorId })),
      skipDuplicates: true,
    });

    return this.prisma.userDevicePermission.findMany({
      where: { userId },
      select: { sensorId: true, assignedAt: true },
      orderBy: { sensorId: "asc" },
    });
  }

  async getDevicePermissions(auth: AuthContext, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (auth.role === Role.COMPANY_ADMIN && user.companyId !== auth.companyId) {
      this.logCompanyBoundaryViolation(auth, "view_user_permissions_outside_company", {
        targetUserId: userId,
      });
      throw new ForbiddenException("Insufficient permission for this user");
    }

    if (auth.role === Role.USER && auth.userId !== userId) {
      throw new ForbiddenException("Users can only view own permissions");
    }

    return this.prisma.userDevicePermission.findMany({
      where: { userId },
      select: { sensorId: true, assignedAt: true },
      orderBy: { sensorId: "asc" },
    });
  }

  private assertCreateUserPolicy(
    auth: AuthContext,
    payload: Pick<CreateUserDto, "role" | "companyId">,
  ): void {
    if (auth.role === Role.SYSTEM_ADMIN) {
      return;
    }

    if (auth.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException("Only admins can create users");
    }

    if (payload.role !== Role.USER) {
      this.logCompanyBoundaryViolation(auth, "company_admin_create_non_user_role");
      throw new ForbiddenException("Company admin can only create USER role");
    }
  }

  private logCompanyBoundaryViolation(
    auth: AuthContext,
    reason: string,
    extra?: Record<string, unknown>,
  ): void {
    this.logger.logEvent(
      "iam_company_boundary_violation",
      {
        reason,
        ...extra,
      },
      {
        context: "IAM",
        level: "warn",
        actor: {
          userId: auth.userId,
          role: auth.role,
          companyId: auth.companyId ?? null,
        },
      },
    );
  }

  private isPrismaForeignKeyViolation(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return true;
    }
    if (typeof error === "object" && error !== null && "code" in error) {
      return (error as { code?: unknown }).code === "P2003";
    }
    return false;
  }

  private async ensureSystemAdmin(): Promise<void> {
    const existing = await this.prisma.user.findFirst({
      where: { role: Role.SYSTEM_ADMIN },
    });
    if (existing) {
      return;
    }

    const email = this.configService.getOrThrow<string>("BOOTSTRAP_ADMIN_EMAIL");
    const password = this.configService.getOrThrow<string>("BOOTSTRAP_ADMIN_PASSWORD");
    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role: Role.SYSTEM_ADMIN,
        companyId: null,
      },
    });
  }
}
