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
import { translate } from "../../utils/translate";
import { UserInfoResponse } from "../../types/UserInfoResponse";
import { parsePaginationParams } from "../../utils/paginationUtils";

const userService = container.resolve(UserService);
const interviewService = container.resolve(InterviewService);

const JWT_SECRET = process.env.JWT_SECRET;

// interface Interview {
//   userId: string;
//   positionName: string;
//   resumeUrl: string;
//   startTime: string;
//   endTime: string | null;
//   duration: number | null;
//   state: boolean;
// }

// interface UserInfoResponse {
//   username: string;
//   credits: number;
//   isVerified: boolean;
//   interviews: Interview[];
//   pagination: {
//     currentPage: number;
//     totalPages: number;
//     pageSize: number;
//     totalItems: number;
//   };
// }

/**
 * @swagger
 * /getUserInfo:
 *   get:
 *     summary: 获取用户信息
 *     tags: [User]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 每页数量
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

  // 应用速率限制
  const rateLimit = rateLimitMiddleware(GENERAL_API_RATE_LIMIT);
  const rateLimitResult = await rateLimit(context, request);
  console.log("rateLimitResult:", rateLimitResult);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const userId = context.user.sub;

    const paginationParams = parsePaginationParams(
      request.query.get("page"),
      request.query.get("limit")
    );

    const user = await userService.getUserById(userId);
    if (!user) {
      return ResponseUtil.error(
        translate(request, "user_not_found"),
        404,
        ERROR_CODES.USER_NOT_FOUND
      );
    }

    const paginatedInterviews = await interviewService.getInterviewsByUserId(
      userId,
      paginationParams
    );

    const userInfo: UserInfoResponse = {
      username: user.username,
      credits: user.credits,
      isVerified: user.isVerified,
      interviews: paginatedInterviews.data,
      pagination: paginatedInterviews.pagination,
    };

    return ResponseUtil.success(userInfo);
  } catch (error) {
    context.error("获取用户信息时发生错误", error);
    return ResponseUtil.error(
      translate(request, "internal_server_error"),
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
