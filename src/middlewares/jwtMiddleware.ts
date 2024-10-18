import {
  HttpRequest,
  InvocationContext,
  HttpResponseInit,
} from "@azure/functions";
import * as jwt from "jsonwebtoken";
import { AuthenticatedContext } from "../types/authenticatedContext";

interface DecodedToken {
  sub: string;
  username: string;
  iat: number;
  exp: number;
}

const TOKEN_EXTENSION = 5 * 60; // 每次调用延长 5 分钟
const MAX_EXPIRATION_TIME = 24 * 60 * 60; // 最大过期时间为 5 小时

const validateJwt = (token: string, secret: string): Promise<DecodedToken> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as DecodedToken);
      }
    });
  });
};

const jwtMiddleware = (secret: string) => {
  return async (
    context: AuthenticatedContext, // 使用 AuthenticatedContext
    req: HttpRequest
  ): Promise<HttpResponseInit | undefined> => {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return {
        status: 401,
        body: "Access denied. No token provided.",
      };
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = await validateJwt(token, secret);
      const currentTimestamp = Math.floor(Date.now() / 1000);

      if (decoded.exp && decoded.exp < currentTimestamp) {
        context.log(`Token expired for user ${decoded.username}`);
        return {
          status: 401,
          body: "Token has expired.",
        };
      }

      context.user = {
        ...decoded,
        username: decoded.username,
        sub: decoded.sub,
      };

      // 计算新的过期时间
      const newExp = Math.min(
        currentTimestamp + TOKEN_EXTENSION,
        decoded.iat + MAX_EXPIRATION_TIME
      );
      const extendedToken = jwt.sign({ ...decoded, exp: newExp }, secret);

      // 在响应中返回新的 token
      context.res = {
        ...context.res,
        headers: {
          ...context.res?.headers,
          "X-New-Token": extendedToken, // 返回新的 token
        },
      };

      return undefined; // 继续执行后续操作
    } catch (error) {
      context.log(`认证失败: ${error.message}`);
      return {
        status: 401,
        body: "无效的token。",
      };
    }
  };
};

export default jwtMiddleware;
