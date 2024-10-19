import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { ResponseUtil } from "../../utils/responseUtil";
import { UserService } from "../../services/userService";
import { container } from "../../di/container";
import { ERROR_CODES } from "../../config/errorCodes";

const userService = container.resolve(UserService);

const httpTrigger = async (request: HttpRequest): Promise<HttpResponseInit> => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const email = url.searchParams.get("email");

  if (!code || !email) {
    return ResponseUtil.error(
      "缺少验证码或邮箱地址",
      400,
      ERROR_CODES.INVALID_INPUT
    );
  }

  try {
    const user = await userService.getUserByUsername(email);
    if (!user) {
      return ResponseUtil.error("用户不存在", 404, ERROR_CODES.USER_NOT_FOUND);
    }

    if (user.verificationCode !== code) {
      return ResponseUtil.error("验证码无效", 400, ERROR_CODES.INVALID_INPUT);
    }

    user.isVerified = true; // 设置用户为已验证
    await userService.updateUserVerified(user); // 更新用户信息

    return ResponseUtil.success({ message: "邮箱验证成功" });
  } catch (error) {
    return ResponseUtil.error(
      "内部服务器错误",
      500,
      ERROR_CODES.INTERNAL_SERVER_ERROR
    );
  }
};

export const verifyEmailFunction = app.http("verifyEmail", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "v1/verify-email",
  handler: httpTrigger,
});
