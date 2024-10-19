import { Interview } from "./Interview";
import { PaginationResult } from "./Pagination";

export interface UserInfoResponse {
  username: string;
  credits: number;
  isVerified: boolean;
  interviews: Interview[];
  pagination: PaginationResult;
}
