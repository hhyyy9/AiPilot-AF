import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { ResponseUtil } from "../../utils/responseUtil";
import { UserService } from "../../services/userService";
import { container } from "../../di/container";
import { ERROR_CODES } from "../../config/errorCodes";
import { translate } from "../../utils/translate";

const userService = container.resolve(UserService);

const httpTrigger = async (request: HttpRequest): Promise<HttpResponseInit> => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const email = url.searchParams.get("email");

  if (!code || !email) {
    return ResponseUtil.error(
      translate(request, "missing_verification_code_or_email"),
      400,
      ERROR_CODES.INVALID_INPUT
    );
  }

  try {
    const user = await userService.getUserByUsername(email);
    if (!user) {
      return ResponseUtil.error(
        translate(request, "user_not_found"),
        404,
        ERROR_CODES.USER_NOT_FOUND
      );
    }

    if (user.verificationCode !== code) {
      return ResponseUtil.error(
        translate(request, "invalid_verification_code"),
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    user.isVerified = true; // 设置用户为已验证
    await userService.updateUserVerified(user); // 更新用户信息

    return ResponseUtil.success({
      message: translate(request, "email_verified_successfully"),
    });
  } catch (error) {
    return ResponseUtil.error(
      translate(request, "internal_server_error"),
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
