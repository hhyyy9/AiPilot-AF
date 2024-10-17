import "reflect-metadata";
import { app } from "@azure/functions";

app.setup({
  enableHttpStream: true,
});

// v1 functions
export { HomePage } from "./functions/HomePage";
export { userLoginFunction } from "./functions/v1/userLogin";
export { aiTriggerFunction } from "./functions/v1/aiTrigger";
export { userRegisterFunction } from "./functions/v1/userRegister";
export { startInterviewFunction } from "./functions/v1/startInterview";
export { endInterviewFunction } from "./functions/v1/endInterview";
export { refreshTokenFunction } from "./functions/v1/refreshToken";
export { createCheckoutSessionFunction } from "./functions/v1/createCheckoutSession";
