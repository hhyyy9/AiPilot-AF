import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { PaymentService } from "../services/paymentService";
import { UserService } from "../services/userService";
import { ResponseUtil } from "../utils/responseUtil";
import jwtMiddleware from "../middlewares/jwtMiddleware";
import { container } from "../di/container";

const paymentService = new PaymentService();
const userService = container.resolve(UserService);
const JWT_SECRET = process.env.JWT_SECRET;

// 定义请求体的接口
interface ConfirmPaymentRequest {
  paymentIntentId: string;
  userId: string;
  credits: number;
}

async function confirmPayment(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  try {
    const { paymentIntentId, userId, credits } = (await request.json()) as {
      paymentIntentId: string;
      userId: string;
      credits: number;
    };
    const paymentIntent = await paymentService.confirmPayment(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      await userService.addCredits(userId, credits);
      return ResponseUtil.success({ message: "支付成功，积分已添加" });
    } else {
      return ResponseUtil.error("支付未成功", 400);
    }
  } catch (error) {
    context.error("确认支付时发生错误", error);
    return ResponseUtil.error("内部服务器错误", 500);
  }
}

app.http("confirmPayment", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: confirmPayment,
});
