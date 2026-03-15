import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../database/prisma.service";
import { InfluxService } from "./influx.service";
import { SensorMetric, SensorMetricReadModel } from "./telemetry.types";
import { AuthContext } from "../common/interfaces/auth-context.interface";
import { resolveDateRangeIso } from "../common/utils/date-range.util";
import { Role } from "../iam/roles.enum";
import { AppLoggerService } from "../logging/app-logger.service";
import { SensorUpdateEventDto } from "./dto/sensor-update-event.dto";
import { TELEMETRY_INGESTED_EVENT } from "./telemetry.constants";

@Injectable()
export class TelemetryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly influxService: InfluxService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: AppLoggerService,
  ) {}

  async registerSensor(payload: { id: string; name: string; companyId?: string }) {
    return this.prisma.sensor.upsert({
      where: { id: payload.id },
      create: {
        id: payload.id,
        name: payload.name,
        companyId: payload.companyId ?? null,
      },
      update: {
        name: payload.name,
        companyId: payload.companyId ?? null,
      },
    });
  }

  async ingestMetric(metric: SensorMetric): Promise<void> {
    await this.prisma.sensor.upsert({
      where: { id: metric.sensorId },
      create: {
        id: metric.sensorId,
        name: metric.sensorId,
      },
      update: {},
    });

    await this.influxService.writeMetric(metric);
    this.logger.logEvent("telemetry_ingested", {
      sensorId: metric.sensorId,
      timestamp: metric.timestamp.toISOString(),
      temperature: metric.temperature,
      humidity: metric.humidity,
    }, {
      context: "Telemetry",
    });
    this.eventEmitter.emit(TELEMETRY_INGESTED_EVENT, SensorUpdateEventDto.fromMetric(metric));
  }

  async getLatest(auth: AuthContext, sensorId: string): Promise<SensorMetricReadModel | null> {
    await this.ensureSensorAccess(auth, sensorId);
    return this.influxService.getLatest(sensorId);
  }

  async getHistory(
    auth: AuthContext,
    sensorId: string,
    from?: string,
    to?: string,
  ): Promise<SensorMetricReadModel[]> {
    await this.ensureSensorAccess(auth, sensorId);
    const { fromIso, toIso } = resolveDateRangeIso(from, to);
    return this.influxService.getHistory(sensorId, fromIso, toIso);
  }

  async ensureSensorAccess(auth: AuthContext, sensorId: string): Promise<void> {
    await this.assertSensorAccess(auth, sensorId);
  }

  private async assertSensorAccess(auth: AuthContext, sensorId: string): Promise<void> {
    const sensor = await this.prisma.sensor.findUnique({ where: { id: sensorId } });
    if (!sensor) {
      throw new NotFoundException("Sensor not found");
    }

    if (auth.role === Role.SYSTEM_ADMIN) {
      return;
    }

    if (auth.role === Role.COMPANY_ADMIN) {
      if (!auth.companyId || sensor.companyId !== auth.companyId) {
        this.throwNoSensorAccess(auth, sensorId, "company_scope_mismatch");
      }
      return;
    }

    const permission = await this.prisma.userDevicePermission.findUnique({
      where: {
        userId_sensorId: {
          userId: auth.userId,
          sensorId,
        },
      },
    });
    if (!permission) {
      this.throwNoSensorAccess(auth, sensorId, "missing_device_permission");
    }
  }

  private throwNoSensorAccess(
    auth: AuthContext,
    sensorId: string,
    reason: string,
  ): never {
    this.logger.logEvent(
      "telemetry_access_denied",
      {
        sensorId,
        reason,
      },
      {
        context: "Telemetry",
        level: "warn",
        actor: {
          userId: auth.userId,
          role: auth.role,
          companyId: auth.companyId ?? null,
        },
      },
    );
    throw new ForbiddenException("No access to this sensor");
  }
}
