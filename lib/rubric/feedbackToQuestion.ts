"use server"

import { generateObject } from "ai"
import { z } from "zod"
import type { StepFeedback } from "@/lib/agent-context"
import { createOpenAI } from "@ai-sdk/openai"

const questionSchema = z.object({
  label: z.string().describe("A concise label for the evaluation criterion"),
  question: z.string().describe("The evaluation question to ask"),
  options: z.array(z.string()).optional().describe("Optional multiple choice options for the question"),
})
const openai = createOpenAI({
  apiKey: process.env.OPEN_AI_KEY,
})

export async function transformFeedbackToQuestion(feedback: StepFeedback): Promise<{
  label: string
  question: string
  options?: string[]
}> {
  const isPositive = feedback.rating === "up"

  const prompt = `Convert this feedback into an evaluation question. The question must be GENERALIZABLE to work for ANY query, not just this specific example.

Feedback: "${feedback.description}"
Step Type: ${feedback.stepType}
${feedback.toolName ? `Tool Name: ${feedback.toolName}` : ""}

INPUT CONTEXT (for understanding structure only):
${feedback.input}

OUTPUT CONTEXT (for understanding structure only):
${feedback.output}

CRITICAL RULES:
1. Keep the EXACT requirement from the feedback - do not add qualifiers, interpretations, or extra criteria
2. Make the question work for ANY query - do not reference specific content from this example
3. Reference structure/format/approach, NOT the specific content
4. Only convert the statement to a question format
5. FOR TOOL-CALLS: Explicitly specify whether evaluating the "tool query" (parameters/input) or "tool response" (output/result)

EXAMPLES:

Feedback: "it should be a table"
Question: "Is the response formatted as a table?"
(NOT: "Is the response about activities formatted as a table?")

Feedback: "missing location parameter"
Question: "Does the tool query include the location parameter?"
(NOT: "Does the tool call include the Bernal Heights location?")

Feedback: "search results are irrelevant"
Question: "Does the tool response contain relevant information?"
(NOT: "Does the search response contain relevant bars in Bernal Heights?")

Feedback: "too many API calls"
Question: "Does the agent minimize API calls?"
(NOT: "Does the agent minimize API calls when searching for bars?")

Feedback: "search query too broad"
Question: "Does the tool query use specific, targeted parameters?"
(NOT: "Does the search query specify Bernal Heights specifically?")

Feedback: "response lacks detail"
Question: "Does the response provide sufficient detail?"
(NOT: "Does the response provide sufficient detail about Bernal Heights?")

Create a question that evaluates ${isPositive ? "whether this positive behavior is present" : "whether this negative behavior is avoided"}.`

  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: questionSchema,
    prompt,
  })

  return object
}
