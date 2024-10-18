import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { AuthenticatedContext } from "../../types/authenticatedContext";
import { rateLimitMiddleware } from "../../middlewares/rateLimitMiddleware";
import { GENERAL_API_RATE_LIMIT } from "../../config/rateLimit";
import jwtMiddleware from "../../middlewares/jwtMiddleware";
import WordExtractor from "word-extractor";
import pdfParse from "pdf-parse";
import { ResponseUtil } from "../../utils/responseUtil";
import { ERROR_CODES } from "../../config/errorCodes";

const JWT_SECRET = process.env.JWT_SECRET;

const SUPPORTED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc
  "application/pdf", // .pdf
  "text/plain", // .txt
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

async function processFile(
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    try {
      const data = await pdfParse(fileBuffer);
      return data.text;
    } catch (error) {
      console.error("Error processing PDF:", error);
      throw new Error(`PDF processing failed: ${error.message}`);
    }
  } else if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    try {
      const extractor = new WordExtractor();
      const extracted = await extractor.extract(fileBuffer);
      return extracted.getBody();
    } catch (error) {
      console.error("Error processing Word document:", error);
      throw new Error(`Word document processing failed: ${error.message}`);
    }
  } else if (mimeType === "text/plain") {
    return fileBuffer.toString("utf-8");
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

const uploadCV = async (
  request: HttpRequest,
  context: AuthenticatedContext
): Promise<HttpResponseInit> => {
  try {
    const jwtResult = await jwtMiddleware(JWT_SECRET)(context, request);
    if (jwtResult) {
      return jwtResult;
    }

    const rateLimit = rateLimitMiddleware(GENERAL_API_RATE_LIMIT);
    const rateLimitResult = await rateLimit(context, request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    const formData = await request.formData();
    const file = formData.get("file") as unknown as File;

    if (!file) {
      return ResponseUtil.error(
        "No file uploaded",
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const mimeType = file.type;
    const fileSize = fileBuffer.length;

    console.log("File name:", fileName);
    console.log("File size:", fileSize, "bytes");
    console.log("MIME type:", mimeType);

    if (fileSize > MAX_FILE_SIZE) {
      return ResponseUtil.error(
        `File size exceeds the maximum limit of 5MB`,
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
      return ResponseUtil.error(
        `Unsupported file type. Supported types are: ${SUPPORTED_MIME_TYPES.join(
          ", "
        )}`,
        400,
        ERROR_CODES.INVALID_INPUT
      );
    }

    const fileContent = await processFile(fileBuffer, mimeType);

    return ResponseUtil.success({ fileContent });
  } catch (error) {
    context.error("Error in uploadCV:", error);
    return ResponseUtil.error(
      `File upload or processing failed: ${error.message}`,
      500,
      ERROR_CODES.INTERNAL_SERVER_ERROR
    );
  }
};

export const uploadCVFunction = app.http("uploadCV", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/uploadCV",
  handler: uploadCV,
});
