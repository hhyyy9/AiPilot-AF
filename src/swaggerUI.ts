import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AiPilot API",
      version: "1.0.0",
      description: "API documentation for AiPilot",
    },
    servers: [
      {
        url: "https://your-function-app-url.azurewebsites.net/api",
      },
    ],
  },
  apis: ["./src/functions/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

async function swaggerUI(request: HttpRequest): Promise<HttpResponseInit> {
  if (request.url.endsWith("/api-docs.json")) {
    return {
      body: JSON.stringify(swaggerSpec),
      headers: {
        "Content-Type": "application/json",
      },
    };
  } else {
    const html = swaggerUi.generateHTML(swaggerSpec);
    return {
      body: html,
      headers: {
        "Content-Type": "text/html",
      },
    };
  }
}

app.http("swaggerUI", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "docs/{*path}",
  handler: swaggerUI,
});
