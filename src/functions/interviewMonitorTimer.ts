import { app, Timer } from "@azure/functions";
import { InterviewMonitorService } from "../services/interviewMonitorService";

const interviewMonitorService = new InterviewMonitorService();

async function interviewMonitorTimer(myTimer: Timer): Promise<void> {
  await interviewMonitorService.checkAndEndInterviews();
}

// app.timer("interviewMonitorTimer", {
//   schedule: "0 0 * * * *",
//   handler: interviewMonitorTimer,
// });
