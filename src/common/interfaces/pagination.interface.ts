/**
 * Pagination metadata interface
 */
export interface IPaginationMeta {
  /**
   * Current page number (1-based)
   */
  readonly page: number;

  /**
   * Number of items per page
   */
  readonly limit: number;

  /**
   * Total number of items
   */
  readonly total: number;

  /**
   * Total number of pages
   */
  readonly totalPages: number;

  /**
   * Whether there is a previous page
   */
  readonly hasPreviousPage: boolean;

  /**
   * Whether there is a next page
   */
  readonly hasNextPage: boolean;
}

/**
 * Paginated result interface
 */
export interface IPaginatedResult<T> {
  /**
   * Array of items for the current page
   */
  readonly data: T[];

  /**
   * Pagination metadata
   */
  readonly meta: IPaginationMeta;
}

/**
 * Pagination options for building results
 */
export interface IPaginationOptions {
  /**
   * Current page number (1-based)
   */
  readonly page: number;

  /**
   * Number of items per page
   */
  readonly limit: number;

  /**
   * Total number of items
   */
  readonly total: number;
}
