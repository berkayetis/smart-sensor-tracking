import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { validateCriticalEnvOrThrow } from "./common/config/critical-env.util";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { SuccessResponseInterceptor } from "./common/interceptors/success-response.interceptor";
import { AppLoggerService } from "./logging/app-logger.service";

async function bootstrap() {
  validateCriticalEnvOrThrow();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLoggerService);
  app.useLogger(logger);
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new SuccessResponseInterceptor());

  app.enableCors({
    origin: "*",
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Akilli Sensor Takip Sistemi API")
    .setDescription("Smart Sensor Tracking backend API documentation")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, swaggerDocument, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      const requestWithContext = req as Request & {
        authContext?: {
          userId?: string;
          role?: string;
          companyId?: string | null;
        };
      };
      logger.logEvent("http_request", {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      }, {
        context: "HTTP",
        actor: {
          userId: requestWithContext.authContext?.userId ?? null,
          role: requestWithContext.authContext?.role ?? null,
          companyId: requestWithContext.authContext?.companyId ?? null,
        },
      });
    });
    next();
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`Smart Sensor Tracking API is running on port ${port}`, "Bootstrap");
  logger.log(`Swagger UI is available at /docs`, "Bootstrap");
}

bootstrap();
