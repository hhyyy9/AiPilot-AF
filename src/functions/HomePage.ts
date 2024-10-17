import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

export async function HomePage(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  // 添加类型断言以解决 'res' 属性不存在的错误
  (context as any).res = {
    status: 200,
    headers: {
      "Content-Type": "text/html",
    },
    body: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to My Azure Function</title>
    </head>
    <body>
        <h1>Welcome to My Azure Function App</h1>
        <p>This is a custom homepage hosted on Azure Functions!</p>
    </body>
    </html>
    `,
  };

  return (context as any).res; // 返回响应
}

app.http("HomePage", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: HomePage,
});
