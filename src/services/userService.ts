import { Container } from "@azure/cosmos";
import * as bcrypt from "bcrypt";
import { injectable, inject } from "tsyringe";
import { DatabaseService } from "./databaseService";

export interface User {
  id?: string;
  username: string;
  password: string;
  credits: number;
}

@injectable()
export class UserService {
  private container: Container;

  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService
  ) {
    this.container = this.databaseService.getContainer("users");
  }

  async createUser(username: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser: User = { username, password: hashedPassword, credits: 30 };
    const { resource: createdUser } = await this.container.items.create(
      newUser
    );
    return createdUser;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const querySpec = {
      query: "SELECT * FROM c WHERE c.username = @username",
      parameters: [{ name: "@username", value: username }],
    };
    const { resources } = await this.container.items
      .query(querySpec)
      .fetchAll();
    return resources[0];
  }

  async getUserById(id: string): Promise<User | undefined> {
    const { resource: user } = await this.container.item(id, id).read();
    return user;
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  async reduceUserCredits(
    userId: string,
    creditsToDeduct: number
  ): Promise<User> {
    const { resource: user } = await this.container.item(userId, userId).read();
    if (!user) {
      throw new Error("用户不存在1");
    }

    user.credits = Math.max(0, user.credits - creditsToDeduct);
    const { resource: updatedUser } = await this.container
      .item(userId, userId)
      .replace(user);
    return updatedUser;
  }

  async resetUserCredits(userId: string): Promise<User> {
    const { resource: user } = await this.container.item(userId, userId).read();
    if (!user) {
      throw new Error("用户不存在2");
    }

    user.credits = 0;
    const { resource: updatedUser } = await this.container
      .item(userId)
      .replace(user);
    return updatedUser;
  }

  async addCredits(userId: string, credits: number): Promise<User> {
    const { resource: user } = await this.container.item(userId, userId).read();
    if (!user) {
      throw new Error("用户不存在");
    }

    user.credits += credits;
    const { resource: updatedUser } = await this.container
      .item(userId, userId)
      .replace(user);
    return updatedUser;
  }
}
