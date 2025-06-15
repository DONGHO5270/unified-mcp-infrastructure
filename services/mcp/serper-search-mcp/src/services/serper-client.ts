import fetch from "node-fetch";
import {
  ISearchParams,
  ISearchResult,
  IScrapeParams,
  IScrapeResult,
} from "../types/serper.js";

/**
 * Interface for Serper API client to allow mocking in tests.
 */
export interface ISerperClient {
  /** Perform a web search using Serper API */
  search(params: ISearchParams): Promise<ISearchResult>;
  /** Scrape a URL using Serper API */
  scrape(params: IScrapeParams): Promise<IScrapeResult>;
}

/**
 * Implementation of Serper API client.
 */
export class SerperClient implements ISerperClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  /**
   * Initialize Serper API client.
   * @param apiKey - Serper API key for authentication
   * @param baseUrl - Base URL for Serper API (optional)
   */
  constructor(apiKey: string, baseUrl: string = "https://google.serper.dev") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Builds a Google search query string with advanced operators
   * @param params - Search parameters including advanced operators
   * @returns Complete query string with operators
   * @private
   */
  private buildAdvancedQuery(params: ISearchParams): string {
    // Normalize spaces in the query
    let query = params.q.trim().replace(/\s+/g, ' ');

    // Add site restriction
    if (params.site) {
      query += ` site:${params.site}`;
    }

    // Add file type filter
    if (params.filetype) {
      query += ` filetype:${params.filetype}`;
    }

    // Add URL word search
    if (params.inurl) {
      query += ` inurl:${params.inurl}`;
    }

    // Add title word search
    if (params.intitle) {
      query += ` intitle:${params.intitle}`;
    }

    // Add related sites search
    if (params.related) {
      query += ` related:${params.related}`;
    }

    // Add cached page view
    if (params.cache) {
      query += ` cache:${params.cache}`;
    }

    // Add date range filters
    if (params.before) {
      query += ` before:${params.before}`;
    }
    if (params.after) {
      query += ` after:${params.after}`;
    }

    // Add exact phrase match
    if (params.exact) {
      query += ` "${params.exact}"`;
    }

    // Add excluded terms
    if (params.exclude) {
      query += params.exclude.split(',').map(term => ` -${term.trim()}`).join('');
    }

    // Add OR terms
    if (params.or) {
      query += ` (${params.or.split(',').map(term => term.trim()).join(' OR ')})`;
    }

    return query.trim();
  }

  async search(params: ISearchParams): Promise<ISearchResult> {
    try {
      // Build the advanced query string
      const queryWithOperators = this.buildAdvancedQuery(params);

      // Create new params object with the enhanced query
      const enhancedParams = {
        ...params,
        q: queryWithOperators,
      };

      const response = await fetch(`${this.baseUrl}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
        },
        body: JSON.stringify(enhancedParams),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Serper API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = (await response.json()) as ISearchResult;
      return data;
    } catch (error) {
      console.error("Serper search failed:", error);
      throw error;
    }
  }

  /**
   * Scrape a URL using Serper API.
   * @param params - Scrape parameters
   * @returns Promise resolving to scrape result
   * @throws Error if API request fails
   */
  async scrape(params: IScrapeParams): Promise<IScrapeResult> {
    if (!params.url) {
      throw new Error("URL is required for scraping");
    }
    try {
      const response = await fetch("https://scrape.serper.dev", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
        },
        body: JSON.stringify(params),
        redirect: "follow",
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Serper API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }
      const result = (await response.json()) as IScrapeResult;
      return result;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
