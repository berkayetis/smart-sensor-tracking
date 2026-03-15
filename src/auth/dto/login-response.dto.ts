import { ApiProperty } from "@nestjs/swagger";

export class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;

  static fromRecord(record: { accessToken: string }): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.accessToken = record.accessToken;
    return dto;
  }
}
