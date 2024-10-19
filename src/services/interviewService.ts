import { Container } from "@azure/cosmos";
import { injectable, inject } from "tsyringe";
import { DatabaseService } from "./databaseService";
import { UserService } from "./userService";
import { Interview } from "../types/Interview";
import { PaginatedResponse, PaginationParams } from "../types/Pagination";

@injectable()
export class InterviewService {
  private interviewsContainer: Container;

  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService,
    @inject(UserService) private userService: UserService
  ) {
    this.interviewsContainer = this.databaseService.getContainer("interviews");
  }

  async getOngoingInterview(interviewId: string): Promise<Interview | null> {
    const { resource: interview } = await this.interviewsContainer
      .item(interviewId, interviewId)
      .read<Interview>();
    return interview && interview.state ? interview : null;
  }

  async getOngoingInterviewByUserId(userId: string): Promise<Interview | null> {
    const querySpec = {
      query: "SELECT * FROM c WHERE c.userId = @userId AND c.state = true",
      parameters: [{ name: "@userId", value: userId }],
    };
    const { resources } = await this.interviewsContainer.items
      .query<Interview>(querySpec)
      .fetchAll();
    return resources[0] || null;
  }

  async getInterviewsByUserId(
    userId: string,
    { page, limit }: PaginationParams
  ): Promise<PaginatedResponse<Interview>> {
    const offset = (page - 1) * limit;

    const querySpec = {
      query:
        "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.startTime DESC OFFSET @offset LIMIT @limit",
      parameters: [
        { name: "@userId", value: userId },
        { name: "@offset", value: offset },
        { name: "@limit", value: limit },
      ],
    };

    const { resources: interviews } = await this.interviewsContainer.items
      .query<Interview>(querySpec)
      .fetchAll();

    const countQuerySpec = {
      query: "SELECT VALUE COUNT(1) FROM c WHERE c.userId = @userId",
      parameters: [{ name: "@userId", value: userId }],
    };

    const { resources: countResult } = await this.interviewsContainer.items
      .query<number>(countQuerySpec)
      .fetchAll();

    const total = countResult[0];

    return {
      data: interviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        pageSize: limit,
        totalItems: total,
      },
    };
  }

  async startInterview(
    userId: string,
    positionName: string,
    resumeUrl: string
  ): Promise<Interview> {
    const user = await this.userService.getUserById(userId);
    if (!user) {
      throw new Error("用户不存在");
    }

    if (user.credits <= 0) {
      throw new Error("积分不足，无法开始面试");
    }

    const startTime = new Date();
    const interviewRecord: Interview = {
      id: this.generateUUID(),
      userId: userId,
      positionName: positionName,
      resumeUrl: resumeUrl,
      startTime: startTime.toISOString(),
      endTime: null,
      duration: null,
      state: true,
    };
    console.log("interviewRecord:", interviewRecord);

    const { resource: createdInterview } =
      await this.interviewsContainer.items.create<Interview>(interviewRecord);
    return createdInterview;
  }

  async endInterviewByUserId(userId: string): Promise<Interview | null> {
    const ongoingInterview = await this.getOngoingInterviewByUserId(userId);

    if (!ongoingInterview) {
      throw new Error("没有找到进行中的面试");
    }

    const endTime = new Date();
    const startTime = new Date(ongoingInterview.startTime);
    const duration = Math.ceil(
      (endTime.getTime() - startTime.getTime()) / (1000 * 60)
    ); // 向上取整到分钟

    const updatedInterview: Interview = {
      ...ongoingInterview,
      endTime: endTime.toISOString(),
      duration: duration,
      state: false,
    };

    const { resource: endedInterview } = await this.interviewsContainer
      .item(ongoingInterview.id, ongoingInterview.id)
      .replace<Interview>(updatedInterview);

    return endedInterview;
  }

  // 辅助函数，用于生成唯一 ID
  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}
