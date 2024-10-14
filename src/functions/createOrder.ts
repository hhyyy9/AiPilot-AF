import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ResponseUtil } from "../utils/responseUtil";
import { OrderService } from "../services/orderService";
import jwtMiddleware from "../middlewares/jwtMiddleware";
import { container } from "../di/container";

const JWT_SECRET = process.env.JWT_SECRET;

interface CreateOrderRequest {
  amount: number;
  currency: string;
}

async function createOrder(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  const orderService = container.resolve(OrderService);

  try {
    const body = (await request.json()) as CreateOrderRequest;
    const { amount, currency } = body;

    if (!amount || !currency) {
      return ResponseUtil.error("金额和货币是必需的");
    }

    const userId = (context as any).user.sub;
    const createdOrder = await orderService.createOrder(
      userId,
      amount,
      currency
    );

    return ResponseUtil.success(
      {
        message: "订单创建成功",
        orderId: createdOrder.id,
      },
      201
    );
  } catch (error) {
    context.error("创建订单时发生错误", error);
    return ResponseUtil.error("内部服务器错误", 500);
  }
}

app.http("createOrder", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: createOrder,
});
