import { ApiProperty } from "@nestjs/swagger";
import { asIsoString } from "../../common/utils/date-time.util";

export class SensorMetricResponseDto {
  @ApiProperty()
  sensorId!: string;

  @ApiProperty()
  timestamp!: string;

  @ApiProperty()
  temperature!: number;

  @ApiProperty()
  humidity!: number;

  static fromRecord(record: {
    sensorId: string;
    timestamp: Date | string;
    temperature: number;
    humidity: number;
  }): SensorMetricResponseDto {
    const dto = new SensorMetricResponseDto();
    dto.sensorId = record.sensorId;
    dto.timestamp = asIsoString(record.timestamp);
    dto.temperature = record.temperature;
    dto.humidity = record.humidity;
    return dto;
  }
}
