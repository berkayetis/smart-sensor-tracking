import { applyDecorators, Type } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from "@nestjs/swagger";
import { SuccessResponseDto } from "../dto/success-response.dto";

type ApiSuccessResponseOptions = {
  type: Type<unknown>;
  isArray?: boolean;
  nullable?: boolean;
  description?: string;
};

export function ApiSuccessResponse(options: ApiSuccessResponseOptions): MethodDecorator {
  const { type, isArray = false, nullable = false, description } = options;
  const dataSchema = isArray
    ? {
        type: "array" as const,
        items: { $ref: getSchemaPath(type) },
      }
    : {
        allOf: [{ $ref: getSchemaPath(type) }],
        nullable,
      };

  return applyDecorators(
    ApiExtraModels(SuccessResponseDto, type),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessResponseDto) },
          {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              data: dataSchema,
            },
            required: ["success", "data"],
          },
        ],
      },
    }),
  );
}
