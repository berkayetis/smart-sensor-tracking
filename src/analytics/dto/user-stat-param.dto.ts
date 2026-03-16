import { IsString, MinLength } from "class-validator";

export class UserStatParamDto {
  @IsString()
  @MinLength(1)
  userId!: string;
}
