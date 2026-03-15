import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { AuthContextService } from "../auth-context.service";
import { AppLoggerService } from "../../logging/app-logger.service";

@Injectable()
export class JwtOnlyGuard implements CanActivate {
  constructor(
    private readonly authContextService: AuthContextService,
    private readonly logger?: AppLoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    try {
      request.authContext = await this.authContextService.resolveFromAuthorizationHeader(
        request.headers.authorization as string | undefined,
      );
      return true;
    } catch (error) {
      this.logger?.logEvent(
        "auth_failed",
        {
          path: request.originalUrl ?? request.url,
          method: request.method,
          reason: error instanceof Error ? error.message : "Unknown auth error",
        },
        {
          context: "Auth",
          level: "warn",
          actor: {
            userId: null,
          },
        },
      );
      throw error;
    }
  }
}
