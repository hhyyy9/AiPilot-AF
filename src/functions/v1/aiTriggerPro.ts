import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import OpenAI from "openai";
import jwtMiddleware from "../../middlewares/jwtMiddleware";
import { ResponseUtil } from "../../utils/responseUtil";
import { InterviewService } from "../../services/interviewService";
import { UserService } from "../../services/userService";
import { container } from "../../di/container";
import { ERROR_CODES } from "../../config/errorCodes";
import { AuthenticatedContext } from "../../types/authenticatedContext";
import { rateLimitMiddleware } from "../../middlewares/rateLimitMiddleware";
import { GENERAL_API_RATE_LIMIT } from "../../config/rateLimit";

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

  const rateLimit = rateLimitMiddleware(GENERAL_API_RATE_LIMIT);
  const rateLimitResult = await rateLimit(context, request);
  if (rateLimitResult) {
    return rateLimitResult;
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

    const response2 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: response.choices[0].message.content,
    });
    console.log("将回答转换为语音", response2);

    // 获取音频流
    const audioStream = response2.body as unknown as Buffer; // 或者使用 Buffer，根据实际情况选择

    // 扣除用户1点积分
    const updatedUser = await userService.reduceUserCredits(user.id, 2);

    return {
      status: 200,
      body: audioStream,
      headers: {
        "Content-Type": "audio/mpeg", // 根据实际音频格式设置
        "Content-Disposition": "attachment; filename=audio.mp3", // 可选：设置下载文件名
      },
    };
  } catch (error) {
    context.error("处理请求时发生错误", error);
    return ResponseUtil.error(
      "内部服务器错误",
      500,
      ERROR_CODES.INTERNAL_SERVER_ERROR
    );
  }
};

// export const aiTriggerFunction = app.http("aiTriggerPro", {
//   methods: ["POST"],
//   authLevel: "anonymous",
//   route: "v1/aiTriggerPro",
//   handler: httpTrigger,
// });
