import { ApiProperty } from "@nestjs/swagger";
import { asIsoString } from "../../common/utils/date-time.util";
import { LogViewPrediction } from "../analytics.service";

export class LogViewPredictionResponseDto {
  @ApiProperty({ example: 24 })
  windowHours!: number;

  @ApiProperty({ example: 48 })
  last24hTotalViews!: number;

  @ApiProperty({ example: 2 })
  last24hHourlyAverage!: number;

  @ApiProperty({ example: 2 })
  predictedNextHourViews!: number;

  @ApiProperty({ example: "2026-03-15T03:10:00.000Z" })
  generatedAt!: string;

  static fromRecord(record: LogViewPrediction): LogViewPredictionResponseDto {
    const dto = new LogViewPredictionResponseDto();
    dto.windowHours = record.windowHours;
    dto.last24hTotalViews = record.last24hTotalViews;
    dto.last24hHourlyAverage = record.last24hHourlyAverage;
    dto.predictedNextHourViews = record.predictedNextHourViews;
    dto.generatedAt = asIsoString(record.generatedAt);
    return dto;
  }
}
