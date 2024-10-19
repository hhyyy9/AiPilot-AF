import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import jwtMiddleware from "../../middlewares/jwtMiddleware";
import { ResponseUtil } from "../../utils/responseUtil";
import { InterviewService } from "../../services/interviewService";
import { container } from "../../di/container";
import { ERROR_CODES } from "../../config/errorCodes";
import { rateLimitMiddleware } from "../../middlewares/rateLimitMiddleware";
import { GENERAL_API_RATE_LIMIT } from "../../config/rateLimit";
import { AuthenticatedContext } from "../../types/authenticatedContext";
import { translate } from "../../utils/translate"; // 引入 translate 函数

const JWT_SECRET = process.env.JWT_SECRET;

const interviewService = container.resolve(InterviewService);

/**
 * @swagger
 * /endInterview:
 *   post:
 *     summary: 结束面试
 *     tags: [Interview]
 *     requestBody:
 *       required: true
 *       content:
 */
async function endInterview(
  request: HttpRequest,
  context: AuthenticatedContext
): Promise<HttpResponseInit> {
  // 应用 JWT 中间件
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  // 应用速率限制中间件
  const rateLimit = rateLimitMiddleware(GENERAL_API_RATE_LIMIT);
  const rateLimitResult = await rateLimit(context, request);
  console.log("rateLimitResult:", rateLimitResult);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const body = (await request.json()) as { userId: string };
    const { userId } = body;

    if (!userId) {
      const message = translate(request, "errorMissingUserId");
      return ResponseUtil.error(message, 400, ERROR_CODES.INVALID_INPUT);
    }

    const endedInterview = await interviewService.endInterviewByUserId(userId);
    if (!endedInterview) {
      const message = translate(request, "no_ongoing_interview");
      return ResponseUtil.error(message, 400, ERROR_CODES.INTERVIEW_NOT_FOUND);
    }

    const successMessage = translate(request, "interviewEnded");
    const durationMessage = translate(request, "interviewDuration", {
      duration: endedInterview.duration,
    });

    return ResponseUtil.success({
      message: successMessage,
      duration: durationMessage,
    });
  } catch (error) {
    context.error("结束面试时发生错误", error);
    const message = translate(request, "internal_server_error");
    return ResponseUtil.error(message, 500, ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
}

export const endInterviewFunction = app.http("endInterview", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/endInterview",
  handler: endInterview,
});
