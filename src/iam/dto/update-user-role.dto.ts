import { IsEnum } from "class-validator";
import { Role } from "../roles.enum";

export class UpdateUserRoleDto {
  @IsEnum(Role)
  role!: Role;
}

