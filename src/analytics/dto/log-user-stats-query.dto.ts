import { Transform } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { DateRangeQueryDto } from "../../common/dto/date-range-query.dto";

export class LogUserStatsQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
