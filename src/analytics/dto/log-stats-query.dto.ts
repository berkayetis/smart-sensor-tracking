import { IsIn, IsOptional } from "class-validator";
import { DateRangeQueryDto } from "../../common/dto/date-range-query.dto";

export class LogStatsQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsIn(["hour"])
  bucket?: "hour";
}
