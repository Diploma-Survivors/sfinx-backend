import { ApiProperty } from '@nestjs/swagger';
import {
  IPaginatedResult,
  IPaginationMeta,
  IPaginationOptions,
} from '../interfaces/pagination.interface';

/**
 * Pagination metadata DTO
 */
export class PaginationMetaDto implements IPaginationMeta {
  @ApiProperty({
    description: 'Current page number (1-based)',
    example: 1,
  })
  readonly page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  readonly limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 100,
  })
  readonly total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  readonly totalPages: number;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  readonly hasPreviousPage: boolean;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  readonly hasNextPage: boolean;

  constructor(options: IPaginationOptions) {
    this.page = options.page;
    this.limit = options.limit;
    this.total = options.total;
    this.totalPages = Math.ceil(options.total / options.limit);
    this.hasPreviousPage = options.page > 1;
    this.hasNextPage = options.page < this.totalPages;
  }
}

/**
 * Generic paginated result DTO
 * Use this to return paginated responses from your endpoints
 *
 * @example
 * // In your service
 * const [data, total] = await this.repository.findAndCount({
 *   skip: query.skip,
 *   take: query.take,
 * });
 *
 * return new PaginatedResultDto(data, {
 *   page: query.page,
 *   limit: query.limit,
 *   total,
 * });
 *
 * @example
 * // In your controller (with Swagger)
 * @ApiOkResponse({ type: PaginatedResultDto })
 * @Get()
 * async findAll(@Query() query: PaginationQueryDto): Promise<PaginatedResultDto<User>> {
 *   return this.service.findAll(query);
 * }
 */
export class PaginatedResultDto<T> implements IPaginatedResult<T> {
  @ApiProperty({
    description: 'Array of items for the current page',
    isArray: true,
  })
  readonly data: T[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  readonly meta: PaginationMetaDto;

  constructor(data: T[], options: IPaginationOptions) {
    this.data = data;
    this.meta = new PaginationMetaDto(options);
  }

  /**
   * Create a paginated result from TypeORM findAndCount result
   */
  static fromFindAndCount<T>(
    result: [T[], number],
    options: Omit<IPaginationOptions, 'total'>,
  ): PaginatedResultDto<T> {
    const [data, total] = result;
    return new PaginatedResultDto(data, { ...options, total });
  }

  /**
   * Create an empty paginated result
   */
  static empty<T>(
    options: Omit<IPaginationOptions, 'total'>,
  ): PaginatedResultDto<T> {
    return new PaginatedResultDto([], { ...options, total: 0 });
  }
}
