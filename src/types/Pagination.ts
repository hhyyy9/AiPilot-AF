export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResult {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationResult;
}
