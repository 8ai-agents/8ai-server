export interface PaginatedResponse<T> {
  total: number;
  skip: number;
  take: number;
  data: T[];
}
