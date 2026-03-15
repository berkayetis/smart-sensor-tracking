import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthContext } from "../interfaces/auth-context.interface";

export const CurrentAuth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthContext | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.authContext as AuthContext | undefined;
  },
);

