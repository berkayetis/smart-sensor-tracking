import { INestApplication, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import request from "supertest";
import { AuthContextService } from "../src/auth/auth-context.service";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { SuccessResponseInterceptor } from "../src/common/interceptors/success-response.interceptor";
import { Role } from "../src/iam/roles.enum";
import { AppLoggerService } from "../src/logging/app-logger.service";
import { TelemetryController } from "../src/telemetry/telemetry.controller";
import { TelemetryService } from "../src/telemetry/telemetry.service";

type AuthContextServiceMock = {
  resolveFromAuthorizationHeader: jest.Mock<
    Promise<{ userId: string; role: Role; companyId: string | null }>,
    [string | undefined]
  >;
};

type TelemetryServiceMock = {
  getLatest: jest.Mock<Promise<null>, [{ userId: string; role: Role; companyId: string | null }, string]>;
  registerSensor: jest.Mock;
  getHistory: jest.Mock;
};

@Module({
  controllers: [TelemetryController],
  providers: [
    AppLoggerService,
    {
      provide: AuthContextService,
      useValue: {
        resolveFromAuthorizationHeader: jest.fn(async (authorization?: string) => {
          if (!authorization?.startsWith("Bearer ")) {
            throw new Error("Bearer token is required");
          }
          return {
            userId: "user-1",
            role: Role.USER,
            companyId: "company-1",
          };
        }),
      },
    },
    {
      provide: TelemetryService,
      useValue: {
        getLatest: jest.fn().mockResolvedValue(null),
        registerSensor: jest.fn(),
        getHistory: jest.fn().mockResolvedValue([]),
      },
    },
  ],
})
class TelemetryLatestSuccessTestModule {}

describe("Telemetry latest endpoint success envelope", () => {
  let app: INestApplication;
  let telemetryService: TelemetryServiceMock;
  let authContextService: AuthContextServiceMock;

  beforeAll(async () => {
    app = await NestFactory.create(TelemetryLatestSuccessTestModule, { bufferLogs: true });
    const logger = app.get(AppLoggerService);
    telemetryService = app.get(TelemetryService);
    authContextService = app.get(AuthContextService);

    app.useLogger(logger);
    app.useGlobalFilters(new GlobalExceptionFilter(logger));
    app.useGlobalInterceptors(new SuccessResponseInterceptor());
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns { success:true, data:null } for GET /sensors/:id/latest when no metric exists", async () => {
    const response = await request(app.getHttpServer())
      .get("/sensors/temp_sensor_01/latest")
      .set("Authorization", "Bearer valid-token")
      .expect(200);

    expect(authContextService.resolveFromAuthorizationHeader).toHaveBeenCalledWith("Bearer valid-token");
    expect(telemetryService.getLatest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        role: Role.USER,
        companyId: "company-1",
      }),
      "temp_sensor_01",
    );
    expect(response.body).toEqual({
      success: true,
      data: null,
    });
  });
});
