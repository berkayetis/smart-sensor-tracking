import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../database/prisma.service";
import { AuthContext } from "../common/interfaces/auth-context.interface";

@Injectable()
export class AuthContextService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async resolveFromAuthorizationHeader(authHeader?: string): Promise<AuthContext> {
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Bearer token is required");
    }
    const token = authHeader.substring(7);
    return this.resolveFromToken(token);
  }

  async resolveFromToken(token: string): Promise<AuthContext> {
    if (!token || token.trim().length === 0) {
      throw new UnauthorizedException("Invalid token");
    }

    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow<string>("JWT_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid token");
    }

    const userId = payload.sub as string;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid user");
    }

    return {
      userId: user.id,
      role: user.role,
      companyId: user.companyId,
    };
  }
}
