import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TelemetryService } from "./telemetry.service";
import { TelemetryController } from "./telemetry.controller";
import { MqttIngestService } from "./mqtt-ingest.service";
import { InfluxService } from "./influx.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [TelemetryService, MqttIngestService, InfluxService],
  controllers: [TelemetryController],
  exports: [TelemetryService],
})
export class TelemetryModule {}
