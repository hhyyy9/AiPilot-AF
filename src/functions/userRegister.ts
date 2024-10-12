import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import bcrypt from 'bcrypt';
import { CosmosClient } from "@azure/cosmos";

const cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
const database = cosmosClient.database("your-database-name");
const container = database.container("users");

interface User {
    id: string;
    username: string;
    password: string;
}

export async function userRegister(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const { username, password } = await request.json();

    if (!username || !password) {
        return { status: 400, body: JSON.stringify({ error: "用户名和密码是必需的" }) };
    }

    try {
        const existingUser = await container.item(username, username).read();
        if (existingUser.resource) {
            return { status: 409, body: JSON.stringify({ error: "用户名已存在" }) };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser: User = { id: username, username, password: hashedPassword };
        await container.items.create(newUser);

        return { status: 201, body: JSON.stringify({ message: "用户注册成功" }) };
    } catch (error) {
        context.error('注册用户时发生错误', error);
        return { status: 500, body: JSON.stringify({ error: "内部服务器错误" }) };
    }
}

app.http('userRegister', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: userRegister
});