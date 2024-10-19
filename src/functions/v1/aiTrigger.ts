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
import { AuthenticatedContext } from "../../types/authenticatedContext";

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
  context: AuthenticatedContext
): Promise<HttpResponseInit> => {
  // 应用 JWT 中间件
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  try {
    const body = (await request.json()) as RequestBody;
    const { interviewId, jobPosition, prompt, language, resumeContent } = body;
    console.log("aiTrigger:", body);

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
        content: `You are a job candidate in an interview. Answer questions in ${language} based on the provided resume. Your responses should be detailed and comprehensive, highlighting key achievements, skills, and relevant experiences. Be professional and specific, providing examples where applicable related to my experiences.`,
      },
      {
        role: "user",
        content: `Job Position: ${jobPosition}\n\nResume content JSON file is:\n\n${resumeContent}\n\nRemember this information for your responses. Please provide a thorough explanation of your qualifications and experiences related to this position.`,
      },
      {
        role: "assistant",
        content:
          "Understood. I'm ready to provide detailed and relevant answers based on the resume.",
      },
      {
        role: "user",
        content: `Interviewer's question: ${prompt}\nPlease provide a clear answer that outlines your qualifications and relevant experience, while being informative but not overly detailed.`,
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      max_tokens: 500, // 增加 max_tokens 的值
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
