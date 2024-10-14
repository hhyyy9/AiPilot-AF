import {
  HttpRequest,
  InvocationContext,
  HttpResponseInit,
} from "@azure/functions";
import NodeCache = require("node-cache");
import { AuthenticatedContext } from "../types/authenticatedContext";

const cache = new NodeCache();

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function rateLimitMiddleware(options: RateLimitOptions) {
  return async (
    context: InvocationContext,
    req: HttpRequest
  ): Promise<HttpResponseInit | undefined> => {
    const userId = (context as AuthenticatedContext).user?.sub || "anonymous";
    const key = `${userId}:${req.method}:${req.url}`;

    let requests = cache.get<number>(key) || 0;
    console.log("rateLimitMiddleware:", key, userId, requests);

    if (requests >= options.max) {
      console.log(`Rate limit exceeded for user: ${userId}`);
      return {
        status: 429,
        body: JSON.stringify({
          error: "Too many requests, please try again later.",
        }),
      };
    }

    cache.set(key, requests + 1, options.windowMs / 1000);

    return undefined;
  };
}
