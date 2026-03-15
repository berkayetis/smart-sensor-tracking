import { ApiProperty } from "@nestjs/swagger";
import { asIsoString } from "../../common/utils/date-time.util";

export class DevicePermissionResponseDto {
  @ApiProperty()
  sensorId!: string;

  @ApiProperty()
  assignedAt!: string;

  static fromRecord(record: {
    sensorId: string;
    assignedAt: Date | string;
  }): DevicePermissionResponseDto {
    const dto = new DevicePermissionResponseDto();
    dto.sensorId = record.sensorId;
    dto.assignedAt = asIsoString(record.assignedAt);
    return dto;
  }
}
