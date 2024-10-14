import { app, Timer } from "@azure/functions";
import { container } from "../../di/container";
import { InterviewMonitorService } from "../../services/interviewMonitorService";

const interviewMonitorService = container.resolve(InterviewMonitorService);

/**
 * @swagger
 * /interviewMonitorTimer:
 *   post:
 *     summary: 面试监控定时器
 *     tags: [Interview]
 *     requestBody:
 *       required: true
 *       content:
 */
async function interviewMonitorTimer(myTimer: Timer): Promise<void> {
  await interviewMonitorService.checkAndEndInterviews();
}

// app.timer("interviewMonitorTimer", {
//   schedule: "0 0 * * * *",
//   handler: interviewMonitorTimer,
// });
