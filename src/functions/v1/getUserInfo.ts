import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import jwtMiddleware from "../../middlewares/jwtMiddleware";
import { ResponseUtil } from "../../utils/responseUtil";
import { UserService } from "../../services/userService";
import { InterviewService } from "../../services/interviewService";
import { container } from "../../di/container";
import { ERROR_CODES } from "../../config/errorCodes";
import { AuthenticatedContext } from "../../types/authenticatedContext";
import { rateLimitMiddleware } from "../../middlewares/rateLimitMiddleware";
import { GENERAL_API_RATE_LIMIT } from "../../config/rateLimit";

const userService = container.resolve(UserService);
const interviewService = container.resolve(InterviewService);

const JWT_SECRET = process.env.JWT_SECRET;

interface UserInfoResponse {
  username: string;
  credits: number;
  isVerified: boolean;
  interviews: any[];
}

/**
 * @swagger
 * /getUserInfo:
 *   get:
 *     summary: 获取用户信息
 *     tags: [User]
 *     responses:
 *       200:
 *         description: 用户信息和面试信息
 *       401:
 *         description: 未授权
 */
const httpTrigger = async (
  request: HttpRequest,
  context: AuthenticatedContext
): Promise<HttpResponseInit> => {
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  // 然后应用速率限制
  const rateLimit = rateLimitMiddleware(GENERAL_API_RATE_LIMIT);
  const rateLimitResult = await rateLimit(context, request);
  console.log("rateLimitResult:", rateLimitResult);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const userId = context.user.sub;

    // 获取用户信息
    const user = await userService.getUserById(userId);
    if (!user) {
      return ResponseUtil.error("用户不存在", 404, ERROR_CODES.USER_NOT_FOUND);
    }

    // 获取用户的面试信息
    const interviews = await interviewService.getOngoingInterviewByUserId(
      userId
    );

    const userInfo: UserInfoResponse = {
      username: user.username,
      credits: user.credits, // 添加用户积分
      isVerified: user.isVerified, // 添加用户验证状态
      interviews: interviews ? [interviews] : [], // 如果有面试信息，返回数组
    };

    return ResponseUtil.success(userInfo);
  } catch (error) {
    context.error("获取用户信息时发生错误", error);
    return ResponseUtil.error(
      "内部服务器错误",
      500,
      ERROR_CODES.INTERNAL_SERVER_ERROR
    );
  }
};

export const getUserInfoFunction = app.http("getUserInfo", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "v1/getUserInfo",
  handler: httpTrigger,
});
