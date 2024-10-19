export interface Interview {
  id: string; // Cosmos DB 中的唯一标识
  userId: string;
  positionName: string;
  resumeUrl: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  state: boolean;
}
