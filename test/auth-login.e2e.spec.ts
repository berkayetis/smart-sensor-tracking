import { INestApplication, Module, UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import request from "supertest";
import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { AppLoggerService } from "../src/logging/app-logger.service";

type AuthServiceMock = {
  login: jest.Mock<Promise<{ accessToken: string }>, [string, string]>;
};

@Module({
  controllers: [AuthController],
  providers: [
    AppLoggerService,
    {
      provide: AuthService,
      useValue: {
        login: jest.fn(),
      },
    },
  ],
})
class AuthTestModule {}

describe("Auth login endpoint", () => {
  let app: INestApplication;
  let authService: AuthServiceMock;

  beforeAll(async () => {
    app = await NestFactory.create(AuthTestModule, { bufferLogs: true });
    const logger = app.get(AppLoggerService);
    authService = app.get(AuthService);

    app.useLogger(logger);
    app.useGlobalFilters(new GlobalExceptionFilter(logger));
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

  it("returns access token for valid credentials", async () => {
    authService.login.mockResolvedValue({ accessToken: "jwt-token" });

    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@example.com", password: "StrongPass123!" })
      .expect(201);

    expect(authService.login).toHaveBeenCalledWith("admin@example.com", "StrongPass123!");
    expect(response.body).toEqual({ accessToken: "jwt-token" });
  });

  it("returns 400 when payload is invalid", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "not-an-email", password: "123" })
      .expect(400);

    expect(authService.login).not.toHaveBeenCalled();
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        path: "/auth/login",
        method: "POST",
      }),
    );
    expect(typeof response.body.message).toBe("string");
  });

  it("returns 401 when credentials are invalid", async () => {
    authService.login.mockRejectedValue(new UnauthorizedException("Invalid credentials"));

    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "admin@example.com", password: "WrongPass123!" })
      .expect(401);

    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        statusCode: 401,
        message: "Invalid credentials",
        path: "/auth/login",
        method: "POST",
      }),
    );
  });
});
