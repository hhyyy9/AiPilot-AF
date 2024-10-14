import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import OpenAI from "openai";
import jwtMiddleware from "../../middlewares/jwtMiddleware";
import { ResponseUtil } from "../../utils/responseUtil";
import { InterviewService } from "../../services/interviewService";
import { UserService } from "../../services/userService";
import { container } from "../../di/container";
import { ERROR_CODES } from "../../config/errorCodes";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const interviewService = container.resolve(InterviewService);
const userService = container.resolve(UserService);

interface RequestBody {
  interviewId: string;
  jobPosition: string;
  prompt: string;
  language: string;
  resumeContent: string;
}

/**
 * @swagger
 * /aiTrigger:
 *   post:
 *     summary: 触发 AI 回答
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *
 */
const httpTrigger = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  // 应用 JWT 中间件
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  try {
    const body = (await request.json()) as RequestBody;
    const { interviewId, jobPosition, prompt, language, resumeContent } = body;

    if (!interviewId) {
      return ResponseUtil.error(
        "缺少 interviewId",
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    const ongoingInterview = await interviewService.getOngoingInterview(
      interviewId
    );
    if (!ongoingInterview) {
      return ResponseUtil.error(
        "当前没有正在进行的面试",
        400,
        ERROR_CODES.INTERVIEW_NOT_FOUND
      );
    }

    const user = await userService.getUserById(ongoingInterview.userId);
    if (!user) {
      return ResponseUtil.error("用户不存在", 404, ERROR_CODES.USER_NOT_FOUND);
    }

    if (user.credits <= 0) {
      return ResponseUtil.error(
        "积分不足，无法继续面试",
        403,
        ERROR_CODES.INSUFFICIENT_CREDITS
      );
    }

    const messages = [
      {
        role: "system",
        content: `You are a job candidate in an interview. Answer questions in ${language} based on the provided resume. Your responses should be concise, highlighting only the most relevant points. Be professional and specific, focusing on key achievements and skills.`,
      },
      {
        role: "user",
        content: `Job Position: ${jobPosition}\n\nResume content:\n\n${resumeContent}\n\nRemember this information for your responses.`,
      },
      {
        role: "assistant",
        content:
          "Understood. I'm ready to provide concise, relevant answers based on the resume.",
      },
      {
        role: "user",
        content: `Interviewer's question: ${prompt}\nProvide a brief, focused answer highlighting key points.`,
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      max_tokens: 300,
    });

    // 扣除用户1点积分
    const updatedUser = await userService.reduceUserCredits(user.id, 1);

    return ResponseUtil.success({
      response: response.choices[0].message.content,
      remainingCredits: updatedUser.credits,
    });
  } catch (error) {
    context.error("处理请求时发生错误", error);
    return ResponseUtil.error(
      "内部服务器错误",
      500,
      ERROR_CODES.INTERNAL_SERVER_ERROR
    );
  }
};

export const aiTriggerFunction = app.http("aiTrigger", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/aiTrigger",
  handler: httpTrigger,
});
