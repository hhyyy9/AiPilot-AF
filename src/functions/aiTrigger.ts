import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import OpenAI from "openai";
import jwtMiddleware from "../middlewares/jwtMiddleware";
import { ResponseUtil } from "../utils/responseUtil";
import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { InterviewService } from "../services/interviewService";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

let cosmosClient: CosmosClient;
if (process.env.NODE_ENV === "development") {
  cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
} else {
  const credential = new DefaultAzureCredential();
  cosmosClient = new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    aadCredentials: credential,
  });
}

// const database = cosmosClient.database("aipilot");
// const interviewsContainer = database.container("interviews");

const interviewService = new InterviewService();

interface RequestBody {
  jobPosition: string;
  prompt: string;
  language: string;
  resumeContent: string;
}

const httpTrigger = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  // 应用 JWT 中间件
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  const username = (context as any).user.name;

  try {
    // 修改这里：我们需要传递一个有效的 interviewId，而不是 username
    const body = (await request.json()) as RequestBody & {
      interviewId: string;
    };
    const { interviewId } = body;

    if (!interviewId) {
      return ResponseUtil.error("缺少 interviewId", 400);
    }

    const ongoingInterview = await interviewService.getOngoingInterview(
      interviewId
    );
    if (!ongoingInterview) {
      return ResponseUtil.error("当前没有正在进行的面试", 400);
    }

    // JWT 验证通过，继续处理请求
    const { jobPosition, prompt, language, resumeContent } = body;

    try {
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

      return {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response: response.choices[0].message.content,
        }),
      };
    } catch (error) {
      context.error("处理请求时发生错误", error);
      return ResponseUtil.error("内部服务器错误", 500);
    }
  } catch (error) {
    context.error("处理请求时发生错误", error);
    return ResponseUtil.error("内部服务器错误", 500);
  }
};

app.http("aiTrigger", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: httpTrigger,
});
