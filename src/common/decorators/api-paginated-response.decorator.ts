import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginatedResultDto } from '../dto/paginated-result.dto';
import { PaginationMetaDto } from '../dto/paginated-result.dto';

/**
 * Swagger decorator for paginated responses
 * Automatically generates proper Swagger documentation for paginated endpoints
 *
 * @param dataDto - The DTO class for the data items
 * @param description - Optional description for the response
 *
 * @example
 * @ApiPaginatedResponse(UserDto, 'Returns paginated list of users')
 * @Get('users')
 * async getUsers(@Query() query: PaginationQueryDto): Promise<PaginatedResultDto<UserDto>> {
 *   return this.service.findAll(query);
 * }
 */
export const ApiPaginatedResponse = <TModel extends Type<any>>(
  dataDto: TModel,
  description?: string,
) => {
  return applyDecorators(
    ApiExtraModels(PaginatedResultDto, PaginationMetaDto, dataDto),
    ApiOkResponse({
      description: description || 'Successfully retrieved paginated results',
      schema: {
        allOf: [
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(dataDto) },
                description: 'Array of items for the current page',
              },
              meta: {
                $ref: getSchemaPath(PaginationMetaDto),
                description: 'Pagination metadata',
              },
            },
            required: ['data', 'meta'],
          },
        ],
      },
    }),
  );
};
