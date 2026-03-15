import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { DateRangeQueryDto } from "../../common/dto/date-range-query.dto";

export class LogEventsQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsIn(["log", "warn", "error"])
  level?: "log" | "warn" | "error";

  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
