import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

@Injectable()
export class SuccessResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    return next.handle().pipe(
      map((payload: unknown) => this.wrap(payload)),
    );
  }

  private wrap(payload: unknown): SuccessEnvelope<unknown> {
    if (this.isSuccessEnvelope(payload)) {
      return payload;
    }

    return {
      success: true,
      data: payload ?? null,
    };
  }

  private isSuccessEnvelope(payload: unknown): payload is SuccessEnvelope<unknown> {
    if (typeof payload !== "object" || payload === null) {
      return false;
    }

    const candidate = payload as Record<string, unknown>;
    return candidate.success === true && "data" in candidate;
  }
}
