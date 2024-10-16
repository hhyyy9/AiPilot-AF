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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-09-30.acacia",
});
const JWT_SECRET = process.env.JWT_SECRET;
const orderService = container.resolve(OrderService);

interface CreateCheckoutSessionRequest {
  priceId: string; // 价格 ID
  successUrl: string; // 成功 URL
  cancelUrl: string; // 取消 URL
}

const WECHAT_PAY_SUPPORTED_CURRENCIES = [
  "aud",
  "cny",
  "cad",
  "chf",
  "eur",
  "dkk",
  "nok",
  "sek",
  "gbp",
  "hkd",
  "jpy",
  "sgd",
  "usd",
];

function isWeChatPaySupported(currency: string): boolean {
  return WECHAT_PAY_SUPPORTED_CURRENCIES.includes(currency.toLowerCase());
}

async function createCheckoutSession(
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
    const body = (await request.json()) as CreateCheckoutSessionRequest;
    const { priceId, successUrl, cancelUrl } = body;
    const userId = context.user.sub;

    if (!priceId || !successUrl || !cancelUrl) {
      return ResponseUtil.error("缺少必要参数", 400, ERROR_CODES.INVALID_INPUT);
    }

    const price = await stripe.prices.retrieve(priceId);
    const currency = price.currency.toLowerCase();

    let paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      ["card", "alipay"];
    let paymentMethodOptions = {};

    if (isWeChatPaySupported(currency)) {
      paymentMethodTypes.push("wechat_pay");
      paymentMethodOptions = {
        wechat_pay: {
          client: "web",
        },
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: paymentMethodTypes,
      payment_method_options: paymentMethodOptions,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
    });

    // 创建订单记录
    await orderService.createCheckoutOrder({
      userId,
      amount: session.amount_total,
      currency: session.currency,
      status: "pending",
      stripeSessionId: session.id,
      priceId: priceId,
    });

    return ResponseUtil.success({
      sessionId: session.id,
      sessionUrl: session.url,
      amount: session.amount_total,
      currency: session.currency,
    });
  } catch (error) {
    context.error("创建 Checkout Session 时发生错误", error);
    if (error.type === "StripeInvalidRequestError") {
      return ResponseUtil.error(error.message, 400, ERROR_CODES.INVALID_INPUT);
    }
    return ResponseUtil.error(
      "内部服务器错误",
      500,
      ERROR_CODES.INTERNAL_SERVER_ERROR
    );
  }
}

export const createCheckoutSessionFunction = app.http("createCheckoutSession", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/create-checkout-session",
  handler: createCheckoutSession,
});
