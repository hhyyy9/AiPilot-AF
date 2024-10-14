import { InvocationContext } from "@azure/functions";

export interface AuthenticatedContext extends InvocationContext {
  user: {
    sub: string; // 这里的 sub 就是 userId
    username: string; // 添加 username
    iat: number;
    exp: number;
  };
}
