import { CosmosClient, Database } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { injectable } from "tsyringe";

@injectable()
export class DatabaseService {
  private database: Database;

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

    this.database = cosmosClient.database("aipilot");
  }

  getContainer(containerName: string) {
    return this.database.container(containerName);
  }
}
