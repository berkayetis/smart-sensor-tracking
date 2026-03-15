export class SensorUpdateEventDto {
  sensorId!: string;
  timestamp!: string;
  temperature!: number;
  humidity!: number;

  static fromMetric(metric: {
    sensorId: string;
    timestamp: Date;
    temperature: number;
    humidity: number;
  }): SensorUpdateEventDto {
    const dto = new SensorUpdateEventDto();
    dto.sensorId = metric.sensorId;
    dto.timestamp = metric.timestamp.toISOString();
    dto.temperature = metric.temperature;
    dto.humidity = metric.humidity;
    return dto;
  }
}
