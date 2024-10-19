import { HttpRequest } from "@azure/functions";
import i18n from "../i18n";

export function translate(
  request: HttpRequest,
  key: string,
  options?: any
): string {
  console.log("request:", request);
  console.log("key:", key);
  console.log("options:", options);

  const lng = request.headers.get("Accept-Language")?.split(",")[0] || "en";
  console.log("lng:", lng);

  return i18n.getFixedT(lng)(key, options) as string;
}
