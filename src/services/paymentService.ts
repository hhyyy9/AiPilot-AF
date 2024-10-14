import Stripe from "stripe";

export class PaymentService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-09-30.acacia",
    });
  }

  async createPaymentIntent(
    amount: number,
    currency: string
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount,
      currency,
    });
  }

  async confirmPayment(
    paymentIntentId: string,
    paymentMethodId: string,
    returnUrl: string
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
      return_url: returnUrl,
    });
  }

  // 新增：创建支付宝支付会话
  async createAlipaySession(
    paymentIntentId: string
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method_types: ["alipay"],
      return_url: process.env.ALIPAY_RETURN_URL, // 设置支付宝回调URL
    });
  }
}
