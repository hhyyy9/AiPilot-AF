import { PaginationParams, PaginationResult } from "../types/Pagination";

export function parsePaginationParams(
  pageStr?: string,
  limitStr?: string
): PaginationParams {
  const page = Math.max(1, parseInt(pageStr || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(limitStr || "10", 10)));
  return { page, limit };
}

export function calculatePagination(
  totalItems: number,
  { page, limit }: PaginationParams
): PaginationResult {
  return {
    currentPage: page,
    totalPages: Math.ceil(totalItems / limit),
    pageSize: limit,
    totalItems,
  };
}
