import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import jwtMiddleware from "../middlewares/jwtMiddleware";
import { ResponseUtil } from "../utils/responseUtil";
import { InterviewService } from "../services/interviewService";
import { container } from "../di/container";

import { rateLimitMiddleware } from "../middlewares/rateLimitMiddleware";
import { GENERAL_API_RATE_LIMIT } from "../config/rateLimit";

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
  context: InvocationContext
): Promise<HttpResponseInit> {
  // 应用 JWT 中间件
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
    const body = (await request.json()) as { userId: string };
    const { userId } = body;

    if (!userId) {
      return ResponseUtil.error("缺少 userId");
    }

    const endedInterview = await interviewService.endInterviewByUserId(userId);
    if (!endedInterview) {
      return ResponseUtil.error("没有找到进行中的面试");
    }

    return ResponseUtil.success({
      message: "面试结束",
      duration: `${endedInterview.duration} 分钟`,
    });
  } catch (error) {
    context.error("结束面试时发生错误", error);
    return ResponseUtil.error("内部服务器错误", 500);
  }
}

app.http("endInterview", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: endInterview,
});
