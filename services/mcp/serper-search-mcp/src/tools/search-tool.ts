import { ISerperClient } from "../services/serper-client.js";
import {
  ISearchParams,
  ISearchResult,
  IScrapeParams,
  IScrapeResult,
} from "../types/serper.js";

/**
 * Search tool implementation for MCP server.
 */
export class SerperSearchTools {
  private serperClient: ISerperClient;

  /**
   * Initialize search tool with Serper client.
   * @param client - Serper API client instance
   */
  constructor(client: ISerperClient) {
    this.serperClient = client;
  }

  /**
   * Execute a web search query.
   * @param query - Search query string
   * @param location - Optional region code for search results
   * @param language - Optional language code for search results
   * @returns Promise resolving to search results
   */
  async search(params: ISearchParams): Promise<ISearchResult> {
    try {
      const result = await this.serperClient.search(params);
      return result;
    } catch (error) {
      throw new Error(
        `SearchTool: failed to search for "${params.q}". ${error}`
      );
    }
  }

  /**
   * Execute a web scrape operation.
   * @param params - Scrape parameters
   * @returns Promise resolving to scrape result
   */
  async scrape(params: IScrapeParams): Promise<IScrapeResult> {
    try {
      const result = await this.serperClient.scrape(params);
      return result;
    } catch (error) {
      throw new Error(`SearchTool: failed to scrape. ${error}`);
    }
  }
}
