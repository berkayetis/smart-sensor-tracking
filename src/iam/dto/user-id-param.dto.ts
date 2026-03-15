import { IsString, MinLength } from "class-validator";

export class UserIdParamDto {
  @IsString()
  @MinLength(1)
  id!: string;
}
