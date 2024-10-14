import { Container } from "@azure/cosmos";
import { injectable, inject } from "tsyringe";
import { DatabaseService } from "./databaseService";

export interface Order {
  id?: string;
  userId: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
  paymentIntentId?: string;
}

@injectable()
export class OrderService {
  private container: Container;

  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService
  ) {
    this.container = this.databaseService.getContainer("orders");
  }

  async createOrder(
    userId: string,
    amount: number,
    currency: string
  ): Promise<Order> {
    const newOrder: Order = {
      userId,
      amount,
      currency,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { resource: createdOrder } = await this.container.items.create(
      newOrder
    );
    return createdOrder;
  }

  async getOrderById(orderId: string): Promise<Order | undefined> {
    const { resource: order } = await this.container
      .item(orderId, orderId)
      .read();
    return order;
  }

  async updateOrderStatus(
    orderId: string,
    status: "completed" | "failed"
  ): Promise<Order> {
    const { resource: existingOrder } = await this.container
      .item(orderId, orderId)
      .read();
    if (!existingOrder) {
      throw new Error("订单不存在");
    }

    existingOrder.status = status;
    existingOrder.updatedAt = new Date();

    const { resource: updatedOrder } = await this.container
      .item(orderId, orderId)
      .replace(existingOrder);
    return updatedOrder;
  }

  async updateOrderPaymentIntent(
    orderId: string,
    paymentIntentId: string
  ): Promise<Order> {
    const { resource: existingOrder } = await this.container
      .item(orderId, orderId)
      .read();
    if (!existingOrder) {
      throw new Error("订单不存在");
    }

    existingOrder.paymentIntentId = paymentIntentId;
    existingOrder.updatedAt = new Date();

    const { resource: updatedOrder } = await this.container
      .item(orderId, orderId)
      .replace(existingOrder);
    return updatedOrder;
  }
}
