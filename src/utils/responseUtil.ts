import { HttpResponseInit } from "@azure/functions";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export class ResponseUtil {
  static success<T>(data: T, status: number = 200): HttpResponseInit {
    const response: ApiResponse<T> = {
      success: true,
      data: data,
    };

    return {
      status: status,
      body: JSON.stringify(response),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }

  static error(
    message: string,
    status: number = 400,
    code?: string
  ): HttpResponseInit {
    const response: ApiResponse<null> = {
      success: false,
      error: message,
      code: code,
    };

    return {
      status: status,
      body: JSON.stringify(response),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
}
