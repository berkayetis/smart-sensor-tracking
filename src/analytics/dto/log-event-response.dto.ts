import { ApiProperty } from "@nestjs/swagger";
import { AppLogEntry } from "../../logging/log-entry.types";

export class LogEventResponseDto {
  @ApiProperty()
  timestamp!: string;

  @ApiProperty({ enum: ["log", "warn", "error"] })
  level!: "log" | "warn" | "error";

  @ApiProperty()
  context!: string;

  @ApiProperty()
  event!: string;

  @ApiProperty({
    nullable: true,
    example: { userId: "user_123", role: "SYSTEM_ADMIN", companyId: null },
  })
  actor!: {
    userId: string | null;
    role?: string | null;
    companyId?: string | null;
  } | null;

  @ApiProperty({ nullable: true })
  extra!: unknown;

  static fromRecord(record: AppLogEntry): LogEventResponseDto {
    const dto = new LogEventResponseDto();
    dto.timestamp = record.timestamp;
    dto.level = record.level;
    dto.context = record.context;
    dto.event = record.event;
    dto.actor = record.actor;
    dto.extra = record.extra;
    return dto;
  }
}
