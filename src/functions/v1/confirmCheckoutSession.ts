import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import Stripe from "stripe";
import { ResponseUtil } from "../../utils/responseUtil";
import jwtMiddleware from "../../middlewares/jwtMiddleware";
import { container } from "../../di/container";
import { AuthenticatedContext } from "../../types/authenticatedContext";
import { ERROR_CODES } from "../../config/errorCodes";
import { rateLimitMiddleware } from "../../middlewares/rateLimitMiddleware";
import { GENERAL_API_RATE_LIMIT } from "../../config/rateLimit";
import { OrderService } from "../../services/orderService";
import { UserService } from "../../services/userService";
import { translate } from "../../utils/translate"; // 引入翻译函数

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-09-30.acacia",
});
const JWT_SECRET = process.env.JWT_SECRET;
const orderService = container.resolve(OrderService);
const userService = container.resolve(UserService);

interface ConfirmCheckoutSessionRequest {
  sessionId: string;
}

async function confirmCheckoutSession(
  request: HttpRequest,
  context: AuthenticatedContext
): Promise<HttpResponseInit> {
  const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
  if (jwtResult) {
    return jwtResult;
  }

  const rateLimit = rateLimitMiddleware(GENERAL_API_RATE_LIMIT);
  const rateLimitResult = await rateLimit(context, request);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  try {
    const body = (await request.json()) as ConfirmCheckoutSessionRequest;
    const { sessionId } = body;
    const userId = context.user.sub;

    if (!sessionId) {
      const message = translate(request, "errorMissingParameters");
      return ResponseUtil.error(message, 400, ERROR_CODES.INVALID_INPUT);
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      const message = translate(request, "errorPaymentIncomplete");
      return ResponseUtil.error(message, 400, ERROR_CODES.PAYMENT_FAILED);
    }

    if (session.client_reference_id !== userId) {
      const message = translate(request, "errorUnauthorizedAccess");
      return ResponseUtil.error(message, 403, ERROR_CODES.FORBIDDEN);
    }

    const updatedOrder = await orderService.updateOrderByStripeSessionId(
      sessionId,
      "completed"
    );

    const existingOrder = await orderService.getOrderByUserSessionId(
      userId,
      sessionId
    );

    let credits = 0;
    if (existingOrder.priceId == "price_1QATNvRr4aL1KjAOIPYp5Yxo") {
      //59.99
      credits = 200;
    } else if (existingOrder.priceId == "price_1QATNwRr4aL1KjAOO004muQj") {
      //149.99
      credits = 600;
    } else if (existingOrder.priceId == "price_1QATNvRr4aL1KjAORDMMLWHg") {
      //419.99
      credits = 2400;
    }
    const updatedUser = await userService.addCredits(userId, credits);

    const successMessage = translate(request, "paymentConfirmed");
    return ResponseUtil.success({
      message: successMessage,
      orderId: updatedOrder.id,
      credits: credits,
      totalCredits: updatedUser.credits,
    });
  } catch (error) {
    context.error("确认 Checkout Session 时发生错误", error);
    if (error.type === "StripeInvalidRequestError") {
      const message = translate(request, "errorStripeInvalidRequest");
      return ResponseUtil.error(message, 400, ERROR_CODES.INVALID_INPUT);
    }
    const internalErrorMessage = translate(request, "internalServerError");
    return ResponseUtil.error(
      internalErrorMessage,
      500,
      ERROR_CODES.INTERNAL_SERVER_ERROR
    );
  }
}

export const confirmCheckoutSessionFunction = app.http(
  "confirmCheckoutSession",
  {
    methods: ["POST"],
    authLevel: "anonymous",
    route: "v1/confirm-checkout-session",
    handler: confirmCheckoutSession,
  }
);
