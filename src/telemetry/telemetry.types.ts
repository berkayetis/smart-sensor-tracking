export interface SensorMetric {
  sensorId: string;
  timestamp: Date;
  temperature: number;
  humidity: number;
}

export interface SensorMetricReadModel {
  sensorId: string;
  timestamp: string;
  temperature: number;
  humidity: number;
}
