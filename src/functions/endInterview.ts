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

async function endInterview(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // 应用 JWT 中间件
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  try {
    const body = (await request.json()) as { interviewId: string };
    const { interviewId } = body;

    if (!interviewId) {
      return ResponseUtil.error("缺少 interviewId");
    }

    const endedInterview = await interviewService.endInterview(interviewId);

    return ResponseUtil.success({
      message: "面试结束",
      duration: `${endedInterview.duration / 1000} 秒`,
    });
  } catch (error) {
    if (error.message === "面试记录不存在") {
      return ResponseUtil.error(error.message, 404);
    } else if (error.message === "该面试已经结束") {
      return ResponseUtil.error(error.message);
    }
    context.error("结束面试时发生错误", error);
    return ResponseUtil.error("内部服务器错误", 500);
  }
}

app.http("endInterview", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: endInterview,
});
