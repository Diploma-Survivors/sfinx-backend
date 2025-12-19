import {
  FindManyOptions,
  FindOptionsOrder,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { PaginatedResultDto } from '../dto/paginated-result.dto';
import { PaginationQueryDto, SortOrder } from '../dto/pagination-query.dto';
import { IPaginationOptions } from '../interfaces/pagination.interface';

/**
 * Pagination utility class
 * Provides helper methods for pagination operations
 */
export class PaginationUtil {
  /**
   * Calculate skip value from page and limit
   */
  static calculateSkip(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * Calculate total pages from total items and limit
   */
  static calculateTotalPages(total: number, limit: number): number {
    return Math.ceil(total / limit);
  }

  /**
   * Build TypeORM FindManyOptions from pagination query
   */
  static buildFindOptions<T>(
    query: PaginationQueryDto,
    additionalOptions: Omit<FindManyOptions<T>, 'skip' | 'take' | 'order'> = {},
  ): FindManyOptions<T> {
    const options: FindManyOptions<T> = {
      ...additionalOptions,
      skip: query.skip,
      take: query.take,
    };

    // Add sorting if provided
    if (query.sortBy) {
      options.order = {
        [query.sortBy]: query.sortOrder || SortOrder.DESC,
      } as FindOptionsOrder<T>;
    }

    return options;
  }

  /**
   * Paginate a TypeORM repository query
   */
  static async paginate<T extends ObjectLiteral>(
    repository: Repository<T>,
    query: PaginationQueryDto,
    findOptions: Omit<FindManyOptions<T>, 'skip' | 'take' | 'order'> = {},
  ): Promise<PaginatedResultDto<T>> {
    const options = this.buildFindOptions(query, findOptions);
    const [data, total] = await repository.findAndCount(options);

    return new PaginatedResultDto(data, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      total,
    });
  }

  /**
   * Create paginated result from data and total count
   */
  static createResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResultDto<T> {
    return new PaginatedResultDto(data, { page, limit, total });
  }

  /**
   * Create paginated result from TypeORM findAndCount result
   */
  static fromFindAndCount<T>(
    result: [T[], number],
    options: Omit<IPaginationOptions, 'total'>,
  ): PaginatedResultDto<T> {
    return PaginatedResultDto.fromFindAndCount(result, options);
  }

  /**
   * Validate pagination parameters
   */
  static validate(page: number, limit: number): void {
    if (page < 1) {
      throw new Error('Page must be greater than or equal to 1');
    }
    if (limit < 1) {
      throw new Error('Limit must be greater than or equal to 1');
    }
    if (limit > 100) {
      throw new Error('Limit must be less than or equal to 100');
    }
  }

  /**
   * Get safe pagination values with defaults
   */
  static getSafeValues(
    page?: number,
    limit?: number,
  ): { page: number; limit: number } {
    const safePage = Math.max(1, page ?? 1);
    const safeLimit = Math.min(100, Math.max(1, limit ?? 20));
    return { page: safePage, limit: safeLimit };
  }
}
