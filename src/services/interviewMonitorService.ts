import { Container } from "@azure/cosmos";
import { injectable, inject } from "tsyringe";
import { DatabaseService } from "./databaseService";
import { InterviewService } from "./interviewService";
import { UserService } from "./userService";

@injectable()
export class InterviewMonitorService {
  private interviewsContainer: Container;

  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService,
    @inject(InterviewService) private interviewService: InterviewService,
    @inject(UserService) private userService: UserService
  ) {
    this.interviewsContainer = this.databaseService.getContainer("interviews");
  }

  async checkAndEndInterviews(): Promise<void> {
    const ongoingInterviews = await this.getOngoingInterviews();

    for (const interview of ongoingInterviews) {
      const user = await this.userService.getUserById(interview.userId);
      if (!user) continue;

      const currentTime = new Date();
      const startTime = new Date(interview.startTime);
      const durationInSeconds = Math.floor(
        (currentTime.getTime() - startTime.getTime()) / 1000
      );

      if (durationInSeconds > user.credits) {
        console.log(
          `结束面试：用户ID ${interview.userId}，面试ID ${interview.id}，持续时间 ${durationInSeconds} 秒，超过用户积分 ${user.credits}`
        );
        // 将用户积分扣为0
        await this.userService.resetUserCredits(user.id);
        console.log(`用户 ${user.id} 的积分已扣为0`);
        await this.interviewService.endInterviewByUserId(user.id);
      }
    }
  }

  private async getOngoingInterviews(): Promise<any[]> {
    const querySpec = {
      query: "SELECT * FROM c WHERE c.state = true",
    };
    const { resources } = await this.interviewsContainer.items
      .query(querySpec)
      .fetchAll();
    return resources;
  }
}
