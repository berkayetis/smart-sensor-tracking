import { ApiProperty } from "@nestjs/swagger";
import { asIsoString } from "../../common/utils/date-time.util";

export class HourlyLogStatResponseDto {
  @ApiProperty()
  hourStart!: string;

  @ApiProperty()
  count!: number;

  static fromRecord(record: {
    hourStart: Date | string;
    count: number;
  }): HourlyLogStatResponseDto {
    const dto = new HourlyLogStatResponseDto();
    dto.hourStart = asIsoString(record.hourStart);
    dto.count = record.count;
    return dto;
  }
}
