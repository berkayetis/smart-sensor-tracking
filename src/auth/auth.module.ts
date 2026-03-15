import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthContextService } from "./auth-context.service";
import { JWT_EXPIRES_IN_FALLBACK } from "./auth.constants";
import { AuthController } from "./auth.controller";
import { JwtOnlyGuard } from "./guards/jwt-only.guard";
import { RolesGuard } from "../common/guards/roles.guard";

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN", JWT_EXPIRES_IN_FALLBACK),
        } as never,
      }),
    }),
  ],
  providers: [AuthService, AuthContextService, JwtOnlyGuard, RolesGuard],
  controllers: [AuthController],
  exports: [AuthService, AuthContextService, JwtOnlyGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
