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
    context: InvocationContext,
    req: HttpRequest
  ): Promise<HttpResponseInit | undefined> => {
    // 首先进行 JWT 验证
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

      (context as AuthenticatedContext).user = {
        ...decoded,
        username: decoded.username,
        sub: decoded.sub,
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
