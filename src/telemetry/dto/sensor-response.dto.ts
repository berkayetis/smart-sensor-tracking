import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { asIsoString } from "../../common/utils/date-time.util";

export class SensorResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  companyId!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  static fromRecord(record: {
    id: string;
    name: string;
    companyId: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): SensorResponseDto {
    const dto = new SensorResponseDto();
    dto.id = record.id;
    dto.name = record.name;
    dto.companyId = record.companyId;
    dto.createdAt = asIsoString(record.createdAt);
    dto.updatedAt = asIsoString(record.updatedAt);
    return dto;
  }
}
