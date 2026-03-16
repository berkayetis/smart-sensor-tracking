import { ApiProperty } from "@nestjs/swagger";
import { UserLogViewStat } from "../analytics.service";

export class UserLogViewStatResponseDto {
  @ApiProperty({ example: "a4fd94fb-c95f-4f57-b87a-9f77cb96fd0e" })
  userId!: string;

  @ApiProperty({ example: "admin@acme.local" })
  email!: string;

  @ApiProperty({ example: 12 })
  count!: number;

  static fromRecord(record: UserLogViewStat): UserLogViewStatResponseDto {
    const dto = new UserLogViewStatResponseDto();
    dto.userId = record.userId;
    dto.email = record.email;
    dto.count = record.count;
    return dto;
  }
}
