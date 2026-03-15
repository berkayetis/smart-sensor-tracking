import { IsNumber, IsString, MinLength } from "class-validator";

export class MqttSensorPayloadDto {
  @IsString()
  @MinLength(1)
  sensor_id!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  timestamp!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  temperature!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  humidity!: number;
}
