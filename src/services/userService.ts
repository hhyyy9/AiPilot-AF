import { CosmosClient, Container } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import * as bcrypt from "bcrypt";

export interface User {
  username: string;
  password: string;
}

export class UserService {
  private container: Container;

  constructor() {
    let cosmosClient: CosmosClient;
    if (process.env.NODE_ENV === "development") {
      cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
    } else {
      const credential = new DefaultAzureCredential();
      cosmosClient = new CosmosClient({
        endpoint: process.env.COSMOS_ENDPOINT,
        aadCredentials: credential,
      });
    }

    const database = cosmosClient.database("aipilot");
    this.container = database.container("users");
  }

  async createUser(username: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser: User = { username, password: hashedPassword };
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
}
