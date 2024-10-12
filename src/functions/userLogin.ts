import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
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

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

interface LoginRequest {
  username: string;
  password: string;
}

export async function userLogin(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let username: string;
  let password: string;

  try {
    const body = await request.json();
    if (typeof body === "object" && body !== null) {
      username = (body as LoginRequest).username;
      password = (body as LoginRequest).password;
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
    const { resource: user } = await container.item(username, username).read();
    if (!user) {
      return {
        status: 401,
        body: JSON.stringify({ error: "用户名或密码不正确" }),
      };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return {
        status: 401,
        body: JSON.stringify({ error: "用户名或密码不正确" }),
      };
    }

    // 生成访问令牌
    const accessToken = jwt.sign({ username: user.username }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // 生成刷新令牌
    const refreshToken = jwt.sign({ username: user.username }, REFRESH_SECRET, {
      expiresIn: "7d",
    });

    return {
      body: JSON.stringify({
        accessToken,
        refreshToken,
      }),
    };
  } catch (error) {
    context.error("登录时发生错误", error);
    return { status: 500, body: JSON.stringify({ error: "内部服务器错误" }) };
  }
}

app.http("userLogin", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: userLogin,
});
