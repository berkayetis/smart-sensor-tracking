import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateSensorDto {
  @IsString()
  @MinLength(2)
  id!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}

