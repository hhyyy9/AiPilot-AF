import { Container } from "@azure/cosmos";
import { injectable, inject } from "tsyringe";
import { DatabaseService } from "./databaseService";
import { UserService } from "./userService";

@injectable()
export class InterviewService {
  private interviewsContainer: Container;

  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService,
    @inject(UserService) private userService: UserService
  ) {
    this.interviewsContainer = this.databaseService.getContainer("interviews");
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
    // console.log("getOngoingInterviewByUserId:", resources);
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

  async endInterviewByUserId(userId: string): Promise<any> {
    const ongoingInterview = await this.getOngoingInterviewByUserId(userId);

    if (!ongoingInterview) {
      throw new Error("没有找到进行中的面试");
    }

    const endTime = new Date();
    const startTime = new Date(ongoingInterview.startTime);
    const duration = Math.ceil(
      (endTime.getTime() - startTime.getTime()) / (1000 * 60)
    ); // 向上取整到分钟

    const updatedInterview = {
      ...ongoingInterview,
      endTime: endTime.toISOString(),
      duration: duration,
      state: false,
    };

    const { resource: endedInterview } = await this.interviewsContainer
      .item(ongoingInterview.id, ongoingInterview.id)
      .replace(updatedInterview);

    return endedInterview;
  }
}
