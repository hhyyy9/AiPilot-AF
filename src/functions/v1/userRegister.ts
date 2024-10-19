import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ResponseUtil } from "../../utils/responseUtil";
import { UserService } from "../../services/userService";
import { container } from "../../di/container";
import { ERROR_CODES } from "../../config/errorCodes";
import { EmailUtil } from "../../utils/emailUtil";
import { translate } from "../../utils/translate";

const userService = container.resolve(UserService);
const emailUtil = container.resolve(EmailUtil);

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
async function userRegister(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as RegisterRequest;
    const { username, password } = body;

    const existingUser = await userService.getUserByUsername(username);
    if (existingUser) {
      return ResponseUtil.error(
        translate(request, "username_already_exists"),
        409,
        ERROR_CODES.USERNAME_ALREADY_EXISTS
      );
    }

    if (!username || !password) {
      return ResponseUtil.error(
        translate(request, "username_or_password_required"),
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    const user = await userService.createUser(username, password);
    emailUtil.sendVerificationEmail(user.username, user.verificationCode);

    return ResponseUtil.success(
      { message: translate(request, "user_register_success") },
      201
    );
  } catch (error) {
    context.error("注册用户时发生错误", error);
    return ResponseUtil.error(
      translate(request, "internal_server_error"),
      500,
      ERROR_CODES.INTERNAL_SERVER_ERROR
    );
  }
}

export const userRegisterFunction = app.http("userRegister", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/userRegister",
  handler: userRegister,
});
