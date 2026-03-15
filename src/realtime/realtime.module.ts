import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TelemetryModule } from "../telemetry/telemetry.module";
import { RealtimeGateway } from "./realtime.gateway";

@Module({
  imports: [AuthModule, TelemetryModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
