import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { CosmosClient } from "@azure/cosmos";

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database("your-database-name");
const container = database.container("users");

const JWT_SECRET = process.env.JWT_SECRET;

export async function userLogin(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const { username, password } = await request.json();

    if (!username || !password) {
        return { status: 400, body: JSON.stringify({ error: "用户名和密码是必需的" }) };
    }

    try {
        const { resource: user } = await container.item(username, username).read();
        if (!user) {
            return { status: 401, body: JSON.stringify({ error: "用户名或密码不正确" }) };
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return { status: 401, body: JSON.stringify({ error: "用户名或密码不正确" }) };
        }

        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        return { body: JSON.stringify({ token }) };
    } catch (error) {
        context.error('登录时发生错误', error);
        return { status: 500, body: JSON.stringify({ error: "内部服务器错误" }) };
    }
}

app.http('userLogin', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: userLogin
});