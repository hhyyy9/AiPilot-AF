import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import jwtMiddleware from "../middlewares/jwtMiddleware";
import { ResponseUtil } from "../utils/responseUtil";
import { InterviewService } from "../services/interviewService";

interface StartInterviewRequest {
  userId: string;
  positionName: string;
  resumeUrl: string;
}

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

const database = cosmosClient.database("aipilot");
const interviewsContainer = database.container("interviews");

const JWT_SECRET = process.env.JWT_SECRET;

const interviewService = new InterviewService();

async function startInterview(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // 应用 JWT 中间件
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  try {
    const body = (await request.json()) as StartInterviewRequest;
    const { userId, positionName, resumeUrl } = body;

    if (!userId || !positionName || !resumeUrl) {
      return ResponseUtil.error("缺少必要参数");
    }

    const ongoingInterview = await interviewService.getOngoingInterviewByUserId(
      userId
    );
    if (ongoingInterview) {
      return ResponseUtil.error(
        "您已有一个正在进行的面试，请先结束当前面试再开始新的面试"
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
    return ResponseUtil.error(error.message, 500);
  }
}

app.http("startInterview", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: startInterview,
});
