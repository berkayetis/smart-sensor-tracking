import { IsString, MinLength } from "class-validator";

export class SensorIdParamDto {
  @IsString()
  @MinLength(1)
  id!: string;
}
