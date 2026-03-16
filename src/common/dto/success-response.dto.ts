import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({
    description: "Endpoint payload wrapped by the global success interceptor",
  })
  data!: unknown;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "Optional metadata for paginated or summarized responses",
  })
  meta?: Record<string, unknown>;
}
