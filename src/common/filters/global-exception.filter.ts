import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AppLoggerService } from "../../logging/app-logger.service";

type RequestWithContext = Request & {
  authContext?: {
    userId?: string;
    role?: string;
    companyId?: string | null;
  };
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithContext>();
    const response = ctx.getResponse<Response>();

    const statusCode = this.getStatusCode(exception);
    const path = request.originalUrl ?? request.url;
    const method = request.method;
    const message = this.getResponseMessage(exception, statusCode);

    this.logger.logEvent("http_exception", {
      method,
      path,
      statusCode,
      errorName: exception instanceof Error ? exception.name : "UnknownError",
      message: this.getLogMessage(exception),
      stack: exception instanceof Error ? exception.stack ?? null : null,
    }, {
      context: "HTTP",
      level: statusCode >= HttpStatus.INTERNAL_SERVER_ERROR ? "error" : "warn",
      actor: {
        userId: request.authContext?.userId ?? null,
        role: request.authContext?.role ?? null,
        companyId: request.authContext?.companyId ?? null,
      },
    });

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path,
      method,
    });
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getResponseMessage(exception: unknown, statusCode: number): string {
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return "Internal server error";
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === "string") {
        return response;
      }
      if (this.isObject(response) && "message" in response) {
        const value = response.message;
        if (Array.isArray(value)) {
          return value.join(", ");
        }
        if (typeof value === "string") {
          return value;
        }
      }
      return exception.message;
    }

    return "Internal server error";
  }

  private getLogMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === "string") {
        return response;
      }
      if (this.isObject(response)) {
        return JSON.stringify(response);
      }
      return exception.message;
    }
    if (exception instanceof Error) {
      return exception.message;
    }
    return "Unknown error";
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
