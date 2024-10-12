import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import * as bcrypt from "bcrypt";
import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

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
const container = database.container("users");

interface User {
  id: string;
  username: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  password: string;
}

export async function userRegister(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let username: string;
  let password: string;

  try {
    const body = await request.json();
    if (typeof body === "object" && body !== null) {
      username = (body as RegisterRequest).username;
      password = (body as RegisterRequest).password;
    } else {
      throw new Error("Invalid request body");
    }
  } catch (error) {
    return { status: 400, body: JSON.stringify({ error: "无效的请求体" }) };
  }

  if (!username || !password) {
    return {
      status: 400,
      body: JSON.stringify({ error: "用户名和密码是必需的" }),
    };
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser: User = { id: username, username, password: hashedPassword };

    await container.items.create(newUser);

    return { status: 201, body: JSON.stringify({ message: "用户注册成功" }) };
  } catch (error) {
    if (error.code === 409) {
      return { status: 409, body: JSON.stringify({ error: "用户名已存在" }) };
    }
    context.error("注册用户时发生错误", error);
    return { status: 500, body: JSON.stringify({ error: error.message }) };
  }
}

app.http("userRegister", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: userRegister,
});
