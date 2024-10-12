import { CosmosClient, Container } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { InterviewService } from "./interviewService";
import { UserService } from "./userService";

export class InterviewMonitorService {
  private interviewsContainer: Container;
  private interviewService: InterviewService;
  private userService: UserService;

  constructor() {
    let cosmosClient: CosmosClient;
    if (process.env.NODE_ENV === "development") {
      cosmosClient = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
    } else {
      const credential = new DefaultAzureCredential();
      cosmosClient = new CosmosClient({
        endpoint: process.env.COSMOS_ENDPOINT,
        aadCredentials: credential,
      });
    }

    const database = cosmosClient.database("aipilot");
    this.interviewsContainer = database.container("interviews");
    this.interviewService = new InterviewService();
    this.userService = new UserService();
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
        await this.interviewService.endInterview(interview.id);
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
