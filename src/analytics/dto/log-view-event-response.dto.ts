import { ApiProperty } from "@nestjs/swagger";

export class LogViewEventResponseDto {
  @ApiProperty({ example: "user_123" })
  user_id!: string;

  @ApiProperty({ example: 1710772800 })
  timestamp!: number;

  @ApiProperty({ example: "viewed_logs", enum: ["viewed_logs"] })
  action!: "viewed_logs";

  static fromRecord(record: {
    userId: string;
    timestamp: number;
    action: "viewed_logs";
  }): LogViewEventResponseDto {
    const dto = new LogViewEventResponseDto();
    dto.user_id = record.userId;
    dto.timestamp = record.timestamp;
    dto.action = record.action;
    return dto;
  }
}
