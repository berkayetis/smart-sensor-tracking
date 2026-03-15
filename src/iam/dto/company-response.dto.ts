import { ApiProperty } from "@nestjs/swagger";
import { asIsoString } from "../../common/utils/date-time.util";

export class CompanyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  static fromRecord(record: {
    id: string;
    name: string;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): CompanyResponseDto {
    const dto = new CompanyResponseDto();
    dto.id = record.id;
    dto.name = record.name;
    dto.createdAt = asIsoString(record.createdAt);
    dto.updatedAt = asIsoString(record.updatedAt);
    return dto;
  }
}
