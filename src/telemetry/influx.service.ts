import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InfluxDB, Point } from "@influxdata/influxdb-client";
import { SensorMetric, SensorMetricReadModel } from "./telemetry.types";

@Injectable()
export class InfluxService {
  private readonly bucket: string;
  private readonly org: string;
  private readonly writeApi;
  private readonly queryApi;

  constructor(private readonly configService?: ConfigService) {
    const url = this.getConfig("INFLUX_URL", "http://localhost:8086");
    const token = this.getConfig("INFLUX_TOKEN", "influx_token");
    this.bucket = this.getConfig("INFLUX_BUCKET", "sensor_metrics");
    this.org = this.getConfig("INFLUX_ORG", "sensor-org");

    const influx = new InfluxDB({ url, token });
    this.writeApi = influx.getWriteApi(this.org, this.bucket, "ns"); //write datas - ns = nano seconds
    this.queryApi = influx.getQueryApi(this.org); //read datas
  }

  private getConfig(key: string, fallback: string): string {
    return this.configService?.get<string>(key, fallback) ?? process.env[key] ?? fallback;
  }

  async writeMetric(metric: SensorMetric): Promise<void> {
    try {
      const point = new Point("sensor_metrics")
        .tag("sensor_id", metric.sensorId)
        .floatField("temperature", metric.temperature)
        .floatField("humidity", metric.humidity)
        .timestamp(metric.timestamp);

      this.writeApi.writePoint(point);
      await this.writeApi.flush();
    } catch (error) {
      throw new InternalServerErrorException({
        message: "Failed to write telemetry to InfluxDB",
        detail: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async getLatest(sensorId: string): Promise<SensorMetricReadModel | null> {
    const escapedSensorId = sensorId.replace(/"/g, '\\"');
    const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => r._measurement == "sensor_metrics" and r.sensor_id == "${escapedSensorId}")
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> keep(columns: ["_time", "temperature", "humidity"])
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: 1)
    `;

    const rows = await this.queryApi.collectRows<Record<string, unknown>>(fluxQuery);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      sensorId,
      timestamp: String(row._time),
      temperature: Number(row.temperature),
      humidity: Number(row.humidity),
    };
  }

  async getHistory(sensorId: string, fromIso: string, toIso: string): Promise<SensorMetricReadModel[]> {
    const escapedSensorId = sensorId.replace(/"/g, '\\"');
    const fluxQuery = `
      from(bucket: "${this.bucket}")
        |> range(start: time(v: "${fromIso}"), stop: time(v: "${toIso}"))
        |> filter(fn: (r) => r._measurement == "sensor_metrics" and r.sensor_id == "${escapedSensorId}")
        |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> keep(columns: ["_time", "temperature", "humidity"])
        |> sort(columns: ["_time"], desc: false)
    `;
    const rows = await this.queryApi.collectRows<Record<string, unknown>>(fluxQuery);
    return rows.map((row) => ({
      sensorId,
      timestamp: String(row._time),
      temperature: Number(row.temperature),
      humidity: Number(row.humidity),
    }));
  }
}
