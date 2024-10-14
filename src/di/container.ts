import "reflect-metadata";
import { container } from "tsyringe";
import { OrderService } from "../services/orderService";
import { DatabaseService } from "../services/databaseService";
import { Container } from "@azure/cosmos";
import { injectable, inject } from "tsyringe";
import { UserService } from "../services/userService";
import { InterviewService } from "../services/interviewService";
import { PaymentService } from "../services/paymentService";

container.register(DatabaseService, {
  useClass: DatabaseService,
});

container.register(OrderService, {
  useClass: OrderService,
});

container.register(UserService, {
  useClass: UserService,
});

container.register(InterviewService, {
  useClass: InterviewService,
});

container.register(PaymentService, {
  useClass: PaymentService,
});

export { container };
