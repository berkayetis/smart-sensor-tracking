import { INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import request from "supertest";
import { AuthContextService } from "../src/auth/auth-context.service";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { SuccessResponseInterceptor } from "../src/common/interceptors/success-response.interceptor";
import { PrismaService } from "../src/database/prisma.service";
import { IamService } from "../src/iam/iam.service";
import { Role } from "../src/iam/roles.enum";
import { UsersController } from "../src/iam/users.controller";
import { AppLoggerService } from "../src/logging/app-logger.service";

type AuthContextServiceMock = {
  resolveFromAuthorizationHeader: jest.Mock<
    Promise<{ userId: string; role: Role; companyId: string | null }>,
    [string | undefined]
  >;
};

const VALID_COMPANY_ID = "550e8400-e29b-41d4-a716-446655440000";

type PrismaServiceMock = {
  company: {
    findUnique: jest.Mock<Promise<{ id: string } | null>, [{ where: { id: string }; select?: { id: true } }]>;
  };
  user: {
    findFirst: jest.Mock<Promise<{ id: string } | null>, [unknown?]>;
    findUnique: jest.Mock<Promise<{ id: string } | null>, [{ where: { email?: string; id?: string } }]>;
    create: jest.Mock<
      Promise<{
        id: string;
        email: string;
        role: Role;
        companyId: string | null;
        createdAt: Date;
      }>,
      [unknown]
    >;
  };
};

const prismaMock: PrismaServiceMock = {
  company: {
    findUnique: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

@Module({
  controllers: [UsersController],
  providers: [
    AppLoggerService,
    IamService,
    {
      provide: AuthContextService,
      useValue: {
        resolveFromAuthorizationHeader: jest.fn(async (authorization?: string) => {
          if (!authorization?.startsWith("Bearer ")) {
            throw new Error("Bearer token is required");
          }
          return {
            userId: "sys-user-1",
            role: Role.SYSTEM_ADMIN,
            companyId: null,
          };
        }),
      },
    },
    {
      provide: PrismaService,
      useValue: prismaMock,
    },
    {
      provide: ConfigService,
      useValue: {
        getOrThrow: jest.fn(() => "unused"),
      },
    },
  ],
})
class UsersCreateCompanyIdValidationTestModule {}

describe("POST /users companyId validation", () => {
  let app: INestApplication;
  let authContextService: AuthContextServiceMock;
  let prisma: PrismaServiceMock;

  beforeAll(async () => {
    app = await NestFactory.create(UsersCreateCompanyIdValidationTestModule, { bufferLogs: true });
    const logger = app.get(AppLoggerService);
    authContextService = app.get(AuthContextService);
    prisma = app.get(PrismaService);

    app.useLogger(logger);
    app.useGlobalFilters(new GlobalExceptionFilter(logger));
    app.useGlobalInterceptors(new SuccessResponseInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  beforeEach(() => {
    prisma.user.findFirst.mockResolvedValue({ id: "existing-system-admin" });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.company.findUnique.mockResolvedValue({ id: VALID_COMPANY_ID });
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "created@acme.local",
      role: Role.USER,
      companyId: VALID_COMPANY_ID,
      createdAt: new Date("2026-03-16T00:00:00.000Z"),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 400 for invalid companyId UUID format", async () => {
    const response = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", "Bearer valid-token")
      .send({
        email: "new-user@acme.local",
        password: "StrongPass123!",
        role: Role.USER,
        companyId: "invalid-company-id",
      })
      .expect(400);

    expect(authContextService.resolveFromAuthorizationHeader).toHaveBeenCalledWith("Bearer valid-token");
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        path: "/users",
        method: "POST",
      }),
    );
    expect(response.body.message).toContain("companyId");
    expect(typeof response.body.timestamp).toBe("string");
  });

  it("returns 400 with Invalid companyId when UUID is valid but company does not exist", async () => {
    prisma.company.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", "Bearer valid-token")
      .send({
        email: "new-user@acme.local",
        password: "StrongPass123!",
        role: Role.USER,
        companyId: VALID_COMPANY_ID,
      })
      .expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        message: "Invalid companyId",
        path: "/users",
        method: "POST",
      }),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(typeof response.body.timestamp).toBe("string");
  });

  it("returns 400 with Invalid companyId when user.create fails with P2003", async () => {
    prisma.user.create.mockRejectedValue({ code: "P2003" });

    const response = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", "Bearer valid-token")
      .send({
        email: "new-user@acme.local",
        password: "StrongPass123!",
        role: Role.USER,
        companyId: VALID_COMPANY_ID,
      })
      .expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        message: "Invalid companyId",
        path: "/users",
        method: "POST",
      }),
    );
    expect(typeof response.body.timestamp).toBe("string");
  });
});
