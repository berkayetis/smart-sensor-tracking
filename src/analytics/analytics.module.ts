import { Module } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsController } from "./analytics.controller";
import { AuthModule } from "../auth/auth.module";
import { LogsController } from "./logs.controller";

@Module({
  imports: [AuthModule],
  providers: [AnalyticsService],
  controllers: [AnalyticsController, LogsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
