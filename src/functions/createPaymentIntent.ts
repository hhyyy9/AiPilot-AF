import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { PaymentService } from "../services/paymentService";
import { ResponseUtil } from "../utils/responseUtil";
import jwtMiddleware from "../middlewares/jwtMiddleware";
import { container } from "../di/container";

const paymentService = container.resolve(PaymentService);
const JWT_SECRET = process.env.JWT_SECRET;

// 定义请求体的接口
interface CreatePaymentIntentRequest {
  amount: number;
  currency: string;
}

async function createPaymentIntent(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  try {
    const { amount, currency } =
      (await request.json()) as CreatePaymentIntentRequest;
    const paymentIntent = await paymentService.createPaymentIntent(
      amount,
      currency
    );
    return ResponseUtil.success({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    context.error("创建支付意向时发生错误", error);
    return ResponseUtil.error("内部服务器错误", 500);
  }
}

app.http("createPaymentIntent", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: createPaymentIntent,
});
