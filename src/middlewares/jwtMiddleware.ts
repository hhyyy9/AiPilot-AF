import {
  HttpRequest,
  InvocationContext,
  HttpResponseInit,
} from "@azure/functions";
import * as jwt from "jsonwebtoken";

interface DecodedToken {
  sub: string;
  name: string;
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
      (context as any).user = decoded;
      context.log(`User ${decoded.name} authenticated successfully`);
      return undefined; // 继续执行后续操作
    } catch (error) {
      context.log(`Authentication failed: ${error.message}`);
      return {
        status: 401,
        body: "Invalid token.",
      };
    }
  };
};

export default jwtMiddleware;
