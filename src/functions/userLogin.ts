import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import * as jwt from "jsonwebtoken";
import { ResponseUtil } from "../utils/responseUtil";
import { UserService } from "../services/userService";
import { container } from "../di/container";

const userService = container.resolve(UserService);

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

interface LoginRequest {
  username: string;
  password: string;
}

export async function userLogin(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as LoginRequest;
    const { username, password } = body;

    if (!username || !password) {
      return ResponseUtil.error("用户名和密码是必需的");
    }

    const user = await userService.getUserByUsername(username);
    if (!user) {
      return ResponseUtil.error("用户名或密码不正确", 401);
    }

    const isPasswordValid = await userService.validatePassword(user, password);
    if (!isPasswordValid) {
      return ResponseUtil.error("用户名或密码不正确", 401);
    }

    // 生成访问令牌
    const accessToken = jwt.sign({ username: user.username }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // 生成刷新令牌
    const refreshToken = jwt.sign({ username: user.username }, REFRESH_SECRET, {
      expiresIn: "7d",
    });

    return ResponseUtil.success({
      userId: user.id,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    context.error("登录时发生错误", error);
    return ResponseUtil.error("内部服务器错误", 500);
  }
}

app.http("userLogin", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: userLogin,
});
