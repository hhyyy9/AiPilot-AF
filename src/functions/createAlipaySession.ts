import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { PaymentService } from "../services/paymentService";
import { OrderService } from "../services/orderService";
import { ResponseUtil } from "../utils/responseUtil";
import jwtMiddleware from "../middlewares/jwtMiddleware";
import { container } from "../di/container";
import { AuthenticatedContext } from "../types/authenticatedContext";

const paymentService = container.resolve(PaymentService);
const orderService = container.resolve(OrderService);
const JWT_SECRET = process.env.JWT_SECRET;

interface CreateAlipaySessionRequest {
  orderId: string;
}

async function createAlipaySession(
  request: HttpRequest,
  context: AuthenticatedContext
): Promise<HttpResponseInit> {
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  try {
    const { orderId } = (await request.json()) as CreateAlipaySessionRequest;
    const userId = context.user.sub;

    const order = await orderService.getOrderById(orderId);
    if (!order) {
      return ResponseUtil.error("订单不存在", 404);
    }

    if (order.userId !== userId) {
      return ResponseUtil.error("无权访问此订单", 403);
    }

    if (!order.paymentIntentId) {
      return ResponseUtil.error("此订单没有关联的支付意向", 400);
    }

    const alipaySession = await paymentService.createAlipaySession(
      order.paymentIntentId
    );

    return ResponseUtil.success({
      message: "支付宝支付会话创建成功",
      redirectUrl: alipaySession.next_action.alipay_handle_redirect.url,
    });
  } catch (error) {
    context.error("创建支付宝支付会话时发生错误", error);
    return ResponseUtil.error("内部服务器错误", 500);
  }
}

app.http("createAlipaySession", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: createAlipaySession,
});
