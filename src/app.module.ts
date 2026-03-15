import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { DatabaseModule } from "./database/database.module";
import { LoggingModule } from "./logging/logging.module";
import { AuthModule } from "./auth/auth.module";
import { IamModule } from "./iam/iam.module";
import { TelemetryModule } from "./telemetry/telemetry.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { AnalyticsModule } from "./analytics/analytics.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 120,
        },
      ],
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    LoggingModule,
    AuthModule,
    IamModule,
    TelemetryModule,
    RealtimeModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
