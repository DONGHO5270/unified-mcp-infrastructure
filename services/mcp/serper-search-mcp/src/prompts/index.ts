import { GetPromptRequestSchema, ListPromptsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { SerperSearchTools } from "../tools/search-tool.js";

interface PromptArgument {
  name: string;
  description: string;
  required?: boolean;
}

interface Prompt {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

const PROMPTS: Record<string, Prompt> = {
  "research-topic": {
    name: "research-topic",
    description: "Guide comprehensive research on a topic with structured results",
    arguments: [
      {
        name: "topic",
        description: "Main topic to research",
        required: true
      },
      {
        name: "depth",
        description: "Research depth (basic or detailed)",
        required: false
      },
      {
        name: "focus_areas",
        description: "Specific areas to focus research on",
        required: false
      }
    ]
  },
  "compare-sources": {
    name: "compare-sources",
    description: "Compare information from multiple sources on a topic",
    arguments: [
      {
        name: "topic",
        description: "Topic to compare sources for",
        required: true
      },
      {
        name: "min_sources",
        description: "Minimum number of sources to compare",
        required: false
      }
    ]
  },
  "fact-check": {
    name: "fact-check",
    description: "Verify a claim across multiple authoritative sources",
    arguments: [
      {
        name: "claim",
        description: "Claim to verify",
        required: true
      },
      {
        name: "thoroughness",
        description: "Verification thoroughness (quick or thorough)",
        required: false
      }
    ]
  },
  "technical-search": {
    name: "technical-search",
    description: "Focused technical and programming search",
    arguments: [
      {
        name: "query",
        description: "Technical query to search for",
        required: true
      },
      {
        name: "tech_stack",
        description: "Relevant technologies to focus on",
        required: false
      },
      {
        name: "content_type",
        description: "Type of content (docs, tutorials, issues)",
        required: false
      }
    ]
  }
};

export class SerperPrompts {
  constructor(private searchTools: SerperSearchTools) {}

  async listPrompts() {
    return {
      prompts: Object.values(PROMPTS)
    };
  }

  async getPrompt(name: string, args: Record<string, any>) {
    const prompt = PROMPTS[name];
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }

    switch (name) {
      case "research-topic":
        return this.getResearchTopicPrompt(args);
      case "compare-sources":
        return this.getCompareSourcesPrompt(args);
      case "fact-check":
        return this.getFactCheckPrompt(args);
      case "news-analysis":
        return this.getNewsAnalysisPrompt(args);
      case "technical-search":
        return this.getTechnicalSearchPrompt(args);
      default:
        throw new Error("Prompt implementation not found");
    }
  }

  private async getResearchTopicPrompt(args: Record<string, any>) {
    const { topic, depth = "basic", focus_areas = [] } = args;
    const focusAreasText = focus_areas.length > 0 
      ? `\nFocus specifically on these areas: ${focus_areas.join(", ")}`
      : "";
    const depthText = depth === "detailed" 
      ? "\nProvide detailed analysis and comprehensive coverage."
      : "\nProvide a basic overview and key points.";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Research the topic: ${topic}${focusAreasText}${depthText}\n\nOrganize the findings into:\n1. Overview\n2. Key Points\n3. Supporting Evidence\n4. Expert Opinions\n5. Conclusions`
          }
        }
      ]
    };
  }

  private async getCompareSourcesPrompt(args: Record<string, any>) {
    const { topic, min_sources = 3 } = args;
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Compare at least ${min_sources} different sources on: ${topic}\n\nAnalyze:\n1. Points of Agreement\n2. Differing Perspectives\n3. Source Credibility\n4. Supporting Evidence\n5. Synthesis of Findings`
          }
        }
      ]
    };
  }

  private async getFactCheckPrompt(args: Record<string, any>) {
    const { claim, thoroughness = "quick" } = args;
    const depth = thoroughness === "thorough"
      ? "\nPerform a comprehensive fact-check using multiple authoritative sources."
      : "\nQuickly verify the main points using reliable sources.";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Fact check this claim: "${claim}"${depth}\n\nProvide:\n1. Verification Status\n2. Supporting Evidence\n3. Authoritative Sources\n4. Context\n5. Final Assessment`
          }
        }
      ]
    };
  }

  private async getNewsAnalysisPrompt(args: Record<string, any>) {
    const { topic, time_range, perspective = "balanced" } = args;
    const timeFilter = time_range ? `\nFocus on coverage from: ${time_range}` : "";
    const perspectiveGuide = perspective === "all"
      ? "\nInclude all viewpoints and perspectives in the analysis."
      : "\nFocus on balanced, factual coverage from reliable sources.";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Analyze news coverage of: ${topic}${timeFilter}${perspectiveGuide}\n\nProvide:\n1. Coverage Overview\n2. Main Narratives\n3. Different Perspectives\n4. Potential Biases\n5. Key Takeaways`
          }
        }
      ]
    };
  }

  private async getTechnicalSearchPrompt(args: Record<string, any>) {
    const { query, tech_stack = [], content_type = "all" } = args;
    const techContext = tech_stack.length > 0
      ? `\nFocus on: ${tech_stack.join(", ")}`
      : "";
    const contentFocus = content_type !== "all"
      ? `\nPrioritize ${content_type} in the results.`
      : "";

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Technical search for: ${query}${techContext}${contentFocus}\n\nOrganize results into:\n1. Best Practices\n2. Implementation Examples\n3. Common Issues\n4. Documentation References\n5. Community Insights`
          }
        }
      ]
    };
  }
}
