import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

export class SetDevicePermissionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sensorIds!: string[];
}

