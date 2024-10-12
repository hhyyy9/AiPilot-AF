import { CosmosClient, Container } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

export class InterviewService {
  private interviewsContainer: Container;
  private usersContainer: Container;

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
    this.usersContainer = database.container("users");
  }

  async getOngoingInterview(interviewId: string): Promise<any> {
    const { resource: interview } = await this.interviewsContainer
      .item(interviewId, interviewId)
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
    return resources[0];
  }

  async startInterview(
    userId: string,
    positionName: string,
    resumeUrl: string
  ): Promise<any> {
    // 检查用户是否存在
    const { resource: user } = await this.usersContainer
      .item(userId, userId)
      .read();
    if (!user) {
      throw new Error("用户不存在");
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
      .item(interviewId, interviewId)
      .read();

    if (!interview) {
      throw new Error("面试记录不存在");
    }

    if (!interview.state) {
      throw new Error("该面试已经结束");
    }

    const endTime = new Date();
    const startTime = new Date(interview.startTime);
    const duration = endTime.getTime() - startTime.getTime();

    const updatedInterview = {
      ...interview,
      endTime: endTime.toISOString(),
      duration: duration,
      state: false,
    };

    const { resource: endedInterview } = await this.interviewsContainer
      .item(interviewId, interviewId)
      .replace(updatedInterview);

    return endedInterview;
  }
}
