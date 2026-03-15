import { BadRequestException, Controller, Get, INestApplication, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import request from "supertest";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { AppLoggerService } from "../src/logging/app-logger.service";

@Controller()
class ErrorController {
  @Get("error")
  throwBadRequest(): never {
    throw new BadRequestException("Validation failed");
  }
}

@Module({
  controllers: [ErrorController],
  providers: [AppLoggerService],
})
class ErrorTestModule {}

describe("Error response integration", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(ErrorTestModule, { bufferLogs: true });
    const logger = app.get(AppLoggerService);
    app.useLogger(logger);
    app.useGlobalFilters(new GlobalExceptionFilter(logger));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns standardized error body", async () => {
    const response = await request(app.getHttpServer()).get("/error").expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        message: "Validation failed",
        path: "/error",
        method: "GET",
      }),
    );
    expect(typeof response.body.timestamp).toBe("string");
  });
});
