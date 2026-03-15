import { INestApplication, Module, UnauthorizedException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import request from "supertest";
import { AuthContextService } from "../src/auth/auth-context.service";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { CompaniesController } from "../src/iam/companies.controller";
import { IamService } from "../src/iam/iam.service";
import { Role } from "../src/iam/roles.enum";
import { AppLoggerService } from "../src/logging/app-logger.service";

type AuthContextServiceMock = {
  resolveFromAuthorizationHeader: jest.Mock<
    Promise<{ userId: string; role: Role; companyId: string | null }>,
    [string | undefined]
  >;
};

@Module({
  controllers: [CompaniesController],
  providers: [
    AppLoggerService,
    {
      provide: AuthContextService,
      useValue: {
        resolveFromAuthorizationHeader: jest.fn(async (authorization?: string) => {
          if (!authorization?.startsWith("Bearer ")) {
            throw new UnauthorizedException("Bearer token is required");
          }
          return {
            userId: "sys-user",
            role: Role.SYSTEM_ADMIN,
            companyId: null,
          };
        }),
      },
    },
    {
      provide: IamService,
      useValue: {
        listCompanies: jest.fn().mockResolvedValue([]),
        createCompany: jest.fn(),
      },
    },
  ],
})
class UnauthorizedAccessTestModule {}

describe("Unauthorized access to protected endpoint", () => {
  let app: INestApplication;
  let authContextService: AuthContextServiceMock;

  beforeAll(async () => {
    app = await NestFactory.create(UnauthorizedAccessTestModule, { bufferLogs: true });
    const logger = app.get(AppLoggerService);
    authContextService = app.get(AuthContextService);

    app.useLogger(logger);
    app.useGlobalFilters(new GlobalExceptionFilter(logger));
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 when GET /companies is called without bearer token", async () => {
    const response = await request(app.getHttpServer()).get("/companies").expect(401);

    expect(authContextService.resolveFromAuthorizationHeader).toHaveBeenCalledWith(undefined);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: 401,
        message: "Bearer token is required",
        path: "/companies",
        method: "GET",
      }),
    );
  });
});
