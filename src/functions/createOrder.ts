import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { ResponseUtil } from "../utils/responseUtil";
import { OrderService } from "../services/orderService";
import { PaymentService } from "../services/paymentService";
import jwtMiddleware from "../middlewares/jwtMiddleware";
import { container } from "../di/container";
import { AuthenticatedContext } from "../types/authenticatedContext";

import { rateLimitMiddleware } from "../middlewares/rateLimitMiddleware";
import { GENERAL_API_RATE_LIMIT } from "../config/rateLimit";

const JWT_SECRET = process.env.JWT_SECRET;

const orderService = container.resolve(OrderService);
const paymentService = container.resolve(PaymentService);

interface CreateOrderRequest {
  amount: number;
  currency: string;
}

/**
 * @swagger
 * /createOrder:
 *   post:
 *     summary: 创建订单
 *     tags: [Order]
 *     requestBody:
 *       required: true
 *       content:
 */
async function createOrder(
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
    const body = (await request.json()) as CreateOrderRequest;
    const { amount, currency } = body;

    if (!amount || !currency) {
      return ResponseUtil.error("金额和货币是必需的");
    }

    // 验证金额是否满足最低要求
    if (amount < 50) {
      // 假设金额以美分为单位
      return ResponseUtil.error("金额必须至少为 50 美分", 400);
    }

    const userId = context.user.sub;
    console.log("userId", userId);

    // 创建订单
    const createdOrder = await orderService.createOrder(
      userId,
      amount,
      currency
    );

    if (!createdOrder || !createdOrder.id) {
      throw new Error("订单创建失败");
    }

    console.log("订单创建成功，ID:", createdOrder.id);

    // 创建支付意向
    const paymentIntent = await paymentService.createPaymentIntent(
      amount,
      currency
    );

    console.log("支付意向创建成功，ID:", paymentIntent.id);

    // 更新订单，添加支付意向ID
    const updatedOrder = await orderService.updateOrderPaymentIntent(
      createdOrder.id,
      paymentIntent.id
    );

    if (!updatedOrder) {
      throw new Error("更新订单支付意向失败");
    }

    console.log("订单更新成功，包含支付意向ID");

    return ResponseUtil.success(
      {
        message: "订单创建成功",
        orderId: createdOrder.id,
        // clientSecret: paymentIntent.client_secret,
        // paymentIntentId: paymentIntent.id,
      },
      201
    );
  } catch (error) {
    context.error("创建订单和支付意向时发生错误", error);
    if (
      error.message === "订单创建失败" ||
      error.message === "更新订单支付意向失败"
    ) {
      return ResponseUtil.error(error.message, 500);
    }
    if (error.type === "StripeInvalidRequestError") {
      return ResponseUtil.error(error.message, 400);
    }
    return ResponseUtil.error("内部服务器错误", 500);
  }
}

app.http("createOrder", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: createOrder,
});
