import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { readFileSync } from "node:fs";
import * as mqtt from "mqtt";
import { TelemetryService } from "./telemetry.service";
import { AppLoggerService } from "../logging/app-logger.service";
import { MqttSensorPayloadDto } from "./dto/mqtt-sensor-payload.dto";

@Injectable()
export class MqttIngestService implements OnModuleInit, OnModuleDestroy {
  private client?: mqtt.MqttClient;
  private topic!: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLoggerService,
  ) {}

  onModuleInit(): void {
    const mqttUrl = this.configService.get<string>("MQTT_URL", "mqtts://localhost:8883");
    this.topic = this.configService.get<string>(
      "MQTT_INGEST_TOPIC",
      "factory/sensors/+/telemetry",
    );
    const rejectUnauthorized = true;
    const tlsCaPath = this.configService.get<string>("MQTT_TLS_CA_PATH");
    const tlsCaCertificate = this.loadTlsCaCertificate(tlsCaPath);

    this.client = mqtt.connect(mqttUrl, {
      username: this.configService.get<string>("MQTT_USERNAME"),
      password: this.configService.get<string>("MQTT_PASSWORD"),
      rejectUnauthorized,
      ca: tlsCaCertificate,
      reconnectPeriod: 5000, // 5 seconds
    });

    this.client.on("connect", () => {
      this.logger.log(`Connected to MQTT broker. Subscribing topic=${this.topic}`, "MQTT");
      this.client?.subscribe(this.topic, (error) => {
        if (error) {
          this.logger.error(error.message, error.stack, "MQTT");
        }
      });
    });

    this.client.on("message", async (_topic, payload) => {
      await this.handleMessage(payload.toString("utf-8"));
    });

    this.client.on("error", (error) => {
      this.logger.logEvent("mqtt_client_error", {
        message: error.message,
        stack: error.stack ?? null,
      }, {
        context: "MQTT",
        level: "error",
      });
    });
  }

  onModuleDestroy(): void {
    this.client?.end();
  }

  private async handleMessage(raw: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      this.logger.logEvent("mqtt_payload_invalid_json", {
        payload: raw,
      }, {
        context: "MQTT",
        level: "warn",
      });
      return;
    }

    const payload = await this.validatePayload(parsed);
    if (!payload) {
      return;
    }

    try {
      await this.telemetryService.ingestMetric({
        sensorId: payload.sensor_id,
        timestamp: new Date(payload.timestamp * 1000),
        temperature: payload.temperature,
        humidity: payload.humidity,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ingest error";
      this.logger.logEvent("mqtt_ingest_failed", {
        payload,
        message,
      }, {
        context: "MQTT",
        level: "error",
      });
      return;
    }

    this.logger.logEvent(
      "mqtt_ingest_processed",
      {
        sensor_id: payload.sensor_id,
        timestamp: payload.timestamp,
        temperature: payload.temperature,
        humidity: payload.humidity,
      },
      {
        context: "MQTT",
      },
    );
  }

  private async validatePayload(payload: unknown): Promise<MqttSensorPayloadDto | null> {
    const dto = plainToInstance(MqttSensorPayloadDto, payload);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const details = errors
        .map((error) => Object.values(error.constraints ?? {}).join(", "))
        .filter((part) => part.length > 0)
        .join("; ");
      this.logger.logEvent("mqtt_payload_validation_failed", {
        payload,
        details: details.length > 0 ? details : "Unknown validation failure",
      }, {
        context: "MQTT",
        level: "warn",
      });
      return null;
    }

    return dto;
  }

  private loadTlsCaCertificate(rawPath?: string): Buffer {
    if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
      throw new Error("Invalid configuration: MQTT_TLS_CA_PATH is required for TLS certificate validation");
    }

    try {
      return readFileSync(rawPath.trim());
    } catch (error) {
      const details = error instanceof Error ? error.message : "Unknown read error";
      throw new Error(
        `Invalid configuration: Unable to read MQTT TLS CA certificate from ${rawPath}. ${details}`,
      );
    }
  }
}
