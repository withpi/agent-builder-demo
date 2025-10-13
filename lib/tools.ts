import {generateText, tool, stepCountIs, ToolResultPart} from "ai"
import { z } from "zod"
import {getFullWebContent, searchWebResults} from "@/lib/toolActions/searchActions";

export const AVAILABLE_TOOLS = {
  search_web_results: tool({
    description:
      "Search the internet for up-to-date website sources that are relevant to a query",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The search query to search the web for",
        ),
      maxResults: z.number().optional().describe("Maximum number of results to return (default: 2)"),
    }),
    execute: async ({ query, maxResults = 2 }) => {
      try {
        console.log("[v0] Executing search_web_results with query:", query)
        return await searchWebResults(query, maxResults);
      } catch (error) {
        console.error("[v0] Tool execution error:", error)
        return { error: "Search failed", results: [] }
      }
    },
  }),
  get_website_content: tool({
    description:
      "Get the full contents of a website link",
    inputSchema: z.object({
      url: z
        .string()
        .describe(
          "The URL of the website to visit",
        ),
    }),
    execute: async ({ url }) => {
      try {
        console.log("[v0] Executing get_website_content with query:", url)
        return await getFullWebContent(url);
      } catch (error) {
        console.error("[v0] Tool execution error:", error)
        return { error: "Search failed", results: [] }
      }
    },
  }),

} as const;