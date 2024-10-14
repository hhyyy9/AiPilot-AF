import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import jwtMiddleware from "../../middlewares/jwtMiddleware";
import { ResponseUtil } from "../../utils/responseUtil";
import { InterviewService } from "../../services/interviewService";
import { container } from "../../di/container";
import { AuthenticatedContext } from "../../types/authenticatedContext";
import { ERROR_CODES } from "../../config/errorCodes";
import { rateLimitMiddleware } from "../../middlewares/rateLimitMiddleware";
import { GENERAL_API_RATE_LIMIT } from "../../config/rateLimit";

interface StartInterviewRequest {
  positionName: string;
  resumeUrl: string;
}

const JWT_SECRET = process.env.JWT_SECRET;

const interviewService = container.resolve(InterviewService);

/**
 * @swagger
 * /startInterview:
 *   post:
 *     summary: 开始面试
 *     tags: [Interview]
 *     requestBody:
 *       required: true
 *       content:
 */
async function startInterview(
  request: HttpRequest,
  context: AuthenticatedContext
): Promise<HttpResponseInit> {
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
    const body = (await request.json()) as StartInterviewRequest;
    const { positionName, resumeUrl } = body;
    const userId = context.user.sub;

    if (!positionName || !resumeUrl) {
      return ResponseUtil.error("缺少必要参数", 400, ERROR_CODES.INVALID_INPUT);
    }

    const ongoingInterview = await interviewService.getOngoingInterviewByUserId(
      userId
    );
    if (ongoingInterview) {
      return ResponseUtil.error(
        "您已有一个正在进行的面试，请先结束当前面试再开始新的面试",
        400,
        ERROR_CODES.INTERVIEW_ALREADY_STARTED
      );
    }

    const createdInterview = await interviewService.startInterview(
      userId,
      positionName,
      resumeUrl
    );
    console.log(createdInterview);

    return ResponseUtil.success({
      message: "面试已开始",
      interviewId: createdInterview.id,
    });
  } catch (error) {
    context.error("开始面试时发生错误", error);
    return ResponseUtil.error(
      error.message,
      500,
      ERROR_CODES.INTERNAL_SERVER_ERROR
    );
  }
}

export const startInterviewFunction = app.http("startInterview", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/startInterview",
  handler: startInterview,
});
