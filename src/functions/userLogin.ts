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

/**
 * @swagger
 * /login:
 *   post:
 *     summary: 用户登录
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: 用户名或密码不正确
 */
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
    console.log("user:", user);
    // 生成访问令牌
    const accessToken = jwt.sign(
      {
        sub: user.id, // 添加 sub 字段，值为用户 ID
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 生成刷新令牌
    const refreshToken = jwt.sign(
      {
        sub: user.id, // 添加 sub 字段，值为用户 ID
        username: user.username,
      },
      REFRESH_SECRET,
      { expiresIn: "7d" }
    );

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
