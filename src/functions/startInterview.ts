import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import jwtMiddleware from "../middlewares/jwtMiddleware";
import { ResponseUtil } from "../utils/responseUtil";
import { InterviewService } from "../services/interviewService";
import { container } from "../di/container";
import { AuthenticatedContext } from "../types/AuthenticatedContext";

interface StartInterviewRequest {
  positionName: string;
  resumeUrl: string;
}

const JWT_SECRET = process.env.JWT_SECRET;

const interviewService = container.resolve(InterviewService);

async function startInterview(
  request: HttpRequest,
  context: AuthenticatedContext
): Promise<HttpResponseInit> {
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  try {
    const body = (await request.json()) as StartInterviewRequest;
    const { positionName, resumeUrl } = body;
    const userId = context.user.sub;

    if (!positionName || !resumeUrl) {
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
