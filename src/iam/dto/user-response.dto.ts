import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { asIsoString } from "../../common/utils/date-time.util";
import { Role } from "../roles.enum";

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiPropertyOptional()
  companyId!: string | null;

  @ApiPropertyOptional()
  createdAt?: string;

  @ApiPropertyOptional()
  updatedAt?: string;

  @ApiPropertyOptional()
  isActive?: boolean;

  static fromRecord(record: {
    id: string;
    email: string;
    role: Role;
    companyId: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    isActive?: boolean;
  }): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = record.id;
    dto.email = record.email;
    dto.role = record.role;
    dto.companyId = record.companyId;
    if (record.createdAt) {
      dto.createdAt = asIsoString(record.createdAt);
    }
    if (record.updatedAt) {
      dto.updatedAt = asIsoString(record.updatedAt);
    }
    if (typeof record.isActive === "boolean") {
      dto.isActive = record.isActive;
    }
    return dto;
  }
}
