import { CosmosClient, Container } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { UserService } from "./userService";

export class InterviewService {
  private interviewsContainer: Container;
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
    this.userService = new UserService();
  }

  async getOngoingInterview(interviewId: string): Promise<any> {
    const { resource: interview } = await this.interviewsContainer
      .item(interviewId)
      .read();
    return interview && interview.state ? interview : null;
  }

  async getOngoingInterviewByUserId(userId: string): Promise<any> {
    const querySpec = {
      query: "SELECT * FROM c WHERE c.userId = @userId AND c.state = true",
      parameters: [{ name: "@userId", value: userId }],
    };
    const { resources } = await this.interviewsContainer.items
      .query(querySpec)
      .fetchAll();
    console.log("getOngoingInterviewByUserId:", resources);
    return resources[0];
  }

  async startInterview(
    userId: string,
    positionName: string,
    resumeUrl: string
  ): Promise<any> {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new Error("用户不存在");
    }

    if (user.credits <= 0) {
      throw new Error("积分不足，无法开始面试");
    }

    const startTime = new Date();
    const interviewRecord = {
      userId: userId,
      positionName: positionName,
      resumeUrl: resumeUrl,
      startTime: startTime.toISOString(),
      endTime: null,
      duration: null,
      state: true,
    };

    const { resource: createdInterview } =
      await this.interviewsContainer.items.create(interviewRecord);
    return createdInterview;
  }

  async endInterview(interviewId: string): Promise<any> {
    const { resource: interview } = await this.interviewsContainer
      .item(interviewId)
      .read();

    if (!interview) {
      throw new Error("面试记录不存在");
    }

    if (!interview.state) {
      throw new Error("该面试已经结束");
    }

    const endTime = new Date();
    const startTime = new Date(interview.startTime);
    const duration = Math.ceil(
      (endTime.getTime() - startTime.getTime()) / 1000
    ); // 向上取整到秒

    const updatedInterview = {
      ...interview,
      endTime: endTime.toISOString(),
      duration: duration,
      state: false,
    };

    const { resource: endedInterview } = await this.interviewsContainer
      .item(interviewId)
      .replace(updatedInterview);

    // 更新用户积分
    await this.userService.updateUserCredits(interview.userId, duration);

    return endedInterview;
  }
}
