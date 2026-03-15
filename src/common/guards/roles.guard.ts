import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Role } from "../../iam/roles.enum";
import { AuthContext } from "../interfaces/auth-context.interface";
import { AppLoggerService } from "../../logging/app-logger.service";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger?: AppLoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authContext = request.authContext as AuthContext | undefined;
    if (!authContext) {
      this.logger?.logEvent(
        "rbac_denied",
        {
          requiredRoles,
          reason: "missing_auth_context",
        },
        {
          context: "Auth",
          level: "warn",
          actor: { userId: null },
        },
      );
      throw new ForbiddenException("Authentication context is missing");
    }

    if (!requiredRoles.includes(authContext.role)) {
      this.logger?.logEvent(
        "rbac_denied",
        {
          requiredRoles,
          reason: "insufficient_role_permissions",
        },
        {
          context: "Auth",
          level: "warn",
          actor: {
            userId: authContext.userId,
            role: authContext.role,
            companyId: authContext.companyId ?? null,
          },
        },
      );
      throw new ForbiddenException("Insufficient role permissions");
    }

    return true;
  }
}
