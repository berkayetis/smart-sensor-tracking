import { INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import request from "supertest";
import { AnalyticsController } from "../src/analytics/analytics.controller";
import { AnalyticsService } from "../src/analytics/analytics.service";
import { AuthContextService } from "../src/auth/auth-context.service";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { SuccessResponseInterceptor } from "../src/common/interceptors/success-response.interceptor";
import { Role } from "../src/iam/roles.enum";
import { AppLoggerService } from "../src/logging/app-logger.service";

type AuthContextServiceMock = {
  resolveFromAuthorizationHeader: jest.Mock<
    Promise<{ userId: string; role: Role; companyId: string | null }>,
    [string | undefined]
  >;
};

type AnalyticsServiceMock = {
  trackLogView: jest.Mock;
  getHourlyStats: jest.Mock;
  getUserStats: jest.Mock;
  getUserStatById: jest.Mock;
  getNextHourPrediction: jest.Mock;
};

@Module({
  controllers: [AnalyticsController],
  providers: [
    AppLoggerService,
    {
      provide: AuthContextService,
      useValue: {
        resolveFromAuthorizationHeader: jest.fn(async (authorization?: string) => {
          if (!authorization?.startsWith("Bearer ")) {
            throw new Error("Expected bearer token");
          }
          return {
            userId: "sys-admin-id",
            role: Role.SYSTEM_ADMIN,
            companyId: null,
          };
        }),
      },
    },
    {
      provide: AnalyticsService,
      useValue: {
        trackLogView: jest.fn(),
        getHourlyStats: jest.fn(),
        getUserStats: jest.fn(),
        getUserStatById: jest.fn(),
        getNextHourPrediction: jest.fn(),
      },
    },
  ],
})
class LogsViewAnalyticsTestModule {}

describe("Logs view analytics endpoints", () => {
  let app: INestApplication;
  let authContextService: AuthContextServiceMock;
  let analyticsService: AnalyticsServiceMock;

  beforeAll(async () => {
    app = await NestFactory.create(LogsViewAnalyticsTestModule, { bufferLogs: true });
    const logger = app.get(AppLoggerService);
    authContextService = app.get(AuthContextService);
    analyticsService = app.get(AnalyticsService);

    app.useLogger(logger);
    app.useGlobalFilters(new GlobalExceptionFilter(logger));
    app.useGlobalInterceptors(new SuccessResponseInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns per-user log view stats in descending count order", async () => {
    analyticsService.getUserStats.mockResolvedValue([
      { userId: "u-1", email: "admin@acme.local", count: 9 },
      { userId: "u-2", email: "user@acme.local", count: 4 },
    ]);

    const response = await request(app.getHttpServer())
      .get("/logs/views/stats/users?limit=50")
      .set("Authorization", "Bearer valid-token")
      .expect(200);

    expect(authContextService.resolveFromAuthorizationHeader).toHaveBeenCalledWith("Bearer valid-token");
    expect(analyticsService.getUserStats).toHaveBeenCalledWith(
      { userId: "sys-admin-id", role: Role.SYSTEM_ADMIN, companyId: null },
      undefined,
      undefined,
      50,
    );
    expect(response.body).toEqual({
      success: true,
      data: [
        { userId: "u-1", email: "admin@acme.local", count: 9 },
        { userId: "u-2", email: "user@acme.local", count: 4 },
      ],
    });
  });

  it("returns a single user log view stat by userId", async () => {
    analyticsService.getUserStatById.mockResolvedValue({
      userId: "u-1",
      email: "admin@acme.local",
      count: 9,
    });

    const response = await request(app.getHttpServer())
      .get("/logs/views/stats/users/u-1?from=2026-03-15T00:00:00.000Z&to=2026-03-16T00:00:00.000Z")
      .set("Authorization", "Bearer valid-token")
      .expect(200);

    expect(analyticsService.getUserStatById).toHaveBeenCalledWith(
      { userId: "sys-admin-id", role: Role.SYSTEM_ADMIN, companyId: null },
      "u-1",
      "2026-03-15T00:00:00.000Z",
      "2026-03-16T00:00:00.000Z",
    );
    expect(response.body).toEqual({
      success: true,
      data: {
        userId: "u-1",
        email: "admin@acme.local",
        count: 9,
      },
    });
  });

  it("does not write viewed_logs event while reading hourly stats and prediction", async () => {
    analyticsService.getHourlyStats.mockResolvedValue([
      { hourStart: "2026-03-15T10:00:00.000Z", count: 12 },
    ]);
    analyticsService.getNextHourPrediction.mockResolvedValue({
      windowHours: 24,
      last24hTotalViews: 48,
      last24hHourlyAverage: 2,
      predictedNextHourViews: 2,
      generatedAt: "2026-03-16T10:00:00.000Z",
    });

    const headers = { Authorization: "Bearer valid-token" };

    await request(app.getHttpServer())
      .get("/logs/views/stats")
      .set(headers)
      .expect(200);
    await request(app.getHttpServer())
      .get("/logs/views/prediction")
      .set(headers)
      .expect(200);

    expect(analyticsService.trackLogView).not.toHaveBeenCalled();
    expect(analyticsService.getHourlyStats).toHaveBeenCalledTimes(1);
    expect(analyticsService.getNextHourPrediction).toHaveBeenCalledTimes(1);
  });
});
