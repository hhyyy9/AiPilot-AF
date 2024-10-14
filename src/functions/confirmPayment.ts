import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { PaymentService } from "../services/paymentService";
import { UserService } from "../services/userService";
import { OrderService } from "../services/orderService";
import { ResponseUtil } from "../utils/responseUtil";
import jwtMiddleware from "../middlewares/jwtMiddleware";
import { container } from "../di/container";
import { AuthenticatedContext } from "../types/authenticatedContext";

import { rateLimitMiddleware } from "../middlewares/rateLimitMiddleware";
import { GENERAL_API_RATE_LIMIT } from "../config/rateLimit";

const paymentService = container.resolve(PaymentService);
const userService = container.resolve(UserService);
const orderService = container.resolve(OrderService);
const JWT_SECRET = process.env.JWT_SECRET;

// 定义请求体的接口
interface ConfirmPaymentRequest {
  orderId: string;
  paymentMethodId: string;
  returnUrl: string;
}

/**
 * @swagger
 * /confirmPayment:
 *   post:
 *     summary: 确认支付
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 **/
async function confirmPayment(
  request: HttpRequest,
  context: AuthenticatedContext
): Promise<HttpResponseInit> {
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  // 然后应用速率限制
  const rateLimit = rateLimitMiddleware(GENERAL_API_RATE_LIMIT);
  const rateLimitResult = await rateLimit(context, request);
  console.log("rateLimitResult:", rateLimitResult);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const { orderId, paymentMethodId, returnUrl } =
      (await request.json()) as ConfirmPaymentRequest;
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

    // 检查订单状态
    if (order.status === "completed") {
      return ResponseUtil.error("订单已经支付成功，请不要重复支付", 400);
    }

    if (order.status === "failed") {
      return ResponseUtil.error("订单支付已失败，请重新创建订单", 400);
    }

    const paymentIntent = await paymentService.confirmPayment(
      order.paymentIntentId,
      paymentMethodId,
      returnUrl
    );

    if (paymentIntent.status === "succeeded") {
      await orderService.updateOrderStatus(orderId, "completed");
      const credits = Math.floor(order.amount / 100); // 假设每1美元兑换1积分
      await userService.addCredits(userId, credits);
      return ResponseUtil.success({
        message: "支付成功，积分已添加",
        credits: credits,
      });
    } else if (paymentIntent.status === "requires_action") {
      // TODO: 需要额外的用户操作，比如 3D Secure 验证
      return ResponseUtil.success({
        message: "需要额外的用户操作",
        nextAction: paymentIntent.next_action,
      });
    } else {
      await orderService.updateOrderStatus(orderId, "failed");
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
