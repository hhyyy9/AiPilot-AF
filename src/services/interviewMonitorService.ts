import { Container } from "@azure/cosmos";
import { injectable, inject } from "tsyringe";
import { DatabaseService } from "./databaseService";
import { InterviewService } from "./interviewService";
import { UserService } from "./userService";
import { Interview } from "../types/Interview";
import { PaginatedResponse, PaginationParams } from "../types/Pagination";

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

    for (const interview of ongoingInterviews.data) {
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

  private async getOngoingInterviews(
    paginationParams: PaginationParams = { page: 1, limit: 100 }
  ): Promise<PaginatedResponse<Interview>> {
    const querySpec = {
      query:
        "SELECT * FROM c WHERE c.state = true ORDER BY c.startTime DESC OFFSET @offset LIMIT @limit",
      parameters: [
        {
          name: "@offset",
          value: (paginationParams.page - 1) * paginationParams.limit,
        },
        { name: "@limit", value: paginationParams.limit },
      ],
    };

    const { resources: interviews } = await this.interviewsContainer.items
      .query<Interview>(querySpec)
      .fetchAll();

    const countQuerySpec = {
      query: "SELECT VALUE COUNT(1) FROM c WHERE c.state = true",
    };

    const { resources: countResult } = await this.interviewsContainer.items
      .query<number>(countQuerySpec)
      .fetchAll();

    const total = countResult[0];

    return {
      data: interviews,
      pagination: {
        currentPage: paginationParams.page,
        totalPages: Math.ceil(total / paginationParams.limit),
        pageSize: paginationParams.limit,
        totalItems: total,
      },
    };
  }
}
