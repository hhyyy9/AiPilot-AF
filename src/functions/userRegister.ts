import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ResponseUtil } from "../utils/responseUtil";
import { UserService } from "../services/userService";
import { container } from "../di/container";

const userService = container.resolve(UserService);

interface RegisterRequest {
  username: string;
  password: string;
}

/**
 * @swagger
 * /userRegister:
 *   post:
 *     summary: 用户注册
 *     tags: [User]
 *     requestBody:
 *       required: true
 *       content:
 */
export async function userRegister(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as RegisterRequest;
    const { username, password } = body;

    const existingUser = await userService.getUserByUsername(username);
    if (existingUser) {
      return ResponseUtil.error("用户名已存在", 409);
    }

    if (!username || !password) {
      return ResponseUtil.error("用户名和密码是必需的");
    }

    await userService.createUser(username, password);

    return ResponseUtil.success({ message: "用户注册成功" }, 201);
  } catch (error) {
    context.error("注册用户时发生错误", error);
    return ResponseUtil.error("内部服务器错误", 500);
  }
}

app.http("userRegister", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: userRegister,
});
