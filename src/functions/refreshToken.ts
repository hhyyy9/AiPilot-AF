import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import * as jwt from "jsonwebtoken";
import { ResponseUtil } from "../utils/responseUtil";

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET; // 为刷新 token 使用单独的密钥

interface RefreshTokenPayload {
  sub: string;
  name: string;
  iat: number;
  exp: number;
}

async function refreshToken(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const refreshToken = request.headers.get("x-refresh-token");

  if (!refreshToken) {
    return ResponseUtil.error("刷新 token 未提供");
  }

  try {
    // 验证刷新 token
    const decoded = jwt.verify(
      refreshToken,
      REFRESH_SECRET
    ) as RefreshTokenPayload;

    // 创建新的访问 token
    const accessToken = jwt.sign(
      { sub: decoded.sub, name: decoded.name },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 创建新的刷新 token
    const newRefreshToken = jwt.sign(
      { sub: decoded.sub, name: decoded.name },
      REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    return ResponseUtil.success({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    context.log(`刷新 token 失败: ${error.message}`);
    return ResponseUtil.error("无效的刷新 token", 401);
  }
}

app.http("refreshToken", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: refreshToken,
});
