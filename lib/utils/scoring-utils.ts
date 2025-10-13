/**
 * Centralized utility for preparing input/output data for scoring different step types.
 * This ensures consistent logic across addFeedback, scoreStep, and backend agent route.
 */

import type { AgentStep } from "@/lib/agent-context"
import { convertStepsToMessages } from "@/lib/utils/messageFormatter"

export interface ScoringData {
  input: string
  output: string
}

// ============================================================================
// Agent Step Functions - Work with AgentStep objects
// ============================================================================

/**
 * Prepares scoring data for a RESPONSE step from agent steps.
 */
export async function prepareResponseFromSteps(
  query: string,
  responseContent: string,
): Promise<ScoringData> {
  console.log("[v0] CLIENT prepareResponseFromSteps:", {
    query: query,
    responseContentLength: responseContent.length,
  })
  console.log("[v0] CLIENT prepareResponseFromSteps - FULL INPUT:", query)
  console.log("[v0] CLIENT prepareResponseFromSteps - FULL OUTPUT:", responseContent)

  return {
    input: query,
    output: responseContent,
  }
}

/**
 * Prepares scoring data for an ACTION step from agent steps.
 *
 * For parallel tool calls, we need to exclude the entire assistant message
 * that contains the current tool call being scored. Since consecutive ACTION
 * steps get grouped into a single assistant message, we need to find where
 * the current "group" of ACTION steps starts and exclude everything from that point.
 */
export async function prepareActionFromSteps(
  precedingSteps: AgentStep[],
  toolName: string,
  toolInput: any,
  userInput: string,
): Promise<ScoringData> {
  // Walk backwards from the end to find where consecutive ACTION steps begin
  let actionGroupStartIndex = precedingSteps.length
  for (let i = precedingSteps.length - 1; i >= 0; i--) {
    if (precedingSteps[i].type === "ACTION") {
      actionGroupStartIndex = i
    } else {
      // Found a non-ACTION step, stop here
      break
    }
  }

  // Only include steps BEFORE the action group starts
  const stepsBeforeActionGroup = precedingSteps.slice(0, actionGroupStartIndex)

  const messagesBeforeToolCall = convertStepsToMessages(stepsBeforeActionGroup, userInput)

  console.log("[v0] CLIENT prepareActionFromSteps:", {
    toolName,
    precedingStepsCount: precedingSteps.length,
    precedingStepTypes: precedingSteps.map((s) => s.type).join(", "),
    actionGroupStartIndex,
    stepsBeforeActionGroupCount: stepsBeforeActionGroup.length,
    stepsBeforeActionGroupTypes: stepsBeforeActionGroup.map((s) => s.type).join(", "),
    messagesCount: messagesBeforeToolCall.length,
    messageRoles: messagesBeforeToolCall.map((m) => m.role).join(", "),
  })
  console.log("[v0] CLIENT prepareActionFromSteps - FULL INPUT:", JSON.stringify(messagesBeforeToolCall, null, 2))
  console.log("[v0] CLIENT prepareActionFromSteps - FULL OUTPUT:", JSON.stringify({ toolName, toolInput }, null, 2))

  return {
    input: JSON.stringify(messagesBeforeToolCall),
    output: JSON.stringify({ toolName, toolInput }),
  }
}

/**
 * Prepares scoring data for an OBSERVATION step from agent steps.
 */
export function prepareObservationFromSteps(toolName: string, toolInput: any, toolOutput: any): ScoringData {
  console.log("[v0] CLIENT prepareObservationFromSteps:", { toolName })
  console.log("[v0] CLIENT prepareObservationFromSteps - FULL INPUT:", JSON.stringify({ toolName, toolInput }, null, 2))
  console.log("[v0] CLIENT prepareObservationFromSteps - FULL OUTPUT:", JSON.stringify(toolOutput, null, 2))
  return {
    input: JSON.stringify({ toolName, toolInput }),
    output: JSON.stringify(toolOutput),
  }
}

/**
 * Prepares scoring data for a THINKING step from agent steps.
 */
export async function prepareThinkingFromSteps(
  precedingSteps: AgentStep[],
  thinkingContent: string,
  userInput: string,
): Promise<ScoringData> {
  const messages = convertStepsToMessages(precedingSteps, userInput)

  console.log("[v0] CLIENT prepareThinkingFromSteps:", {
    precedingStepsCount: precedingSteps.length,
    stepTypes: precedingSteps.map((s) => s.type).join(", "),
    messagesCount: messages.length,
    messageRoles: messages.map((m) => m.role).join(", "),
    thinkingContentLength: thinkingContent.length,
  })
  console.log("[v0] CLIENT prepareThinkingFromSteps - FULL INPUT:", JSON.stringify(messages, null, 2))
  console.log("[v0] CLIENT prepareThinkingFromSteps - FULL OUTPUT:", thinkingContent)

  return {
    input: JSON.stringify(messages),
    output: thinkingContent,
  }
}

// ============================================================================
// Message Functions - Work with message objects directly
// ============================================================================

/**
 * Prepares scoring data for a RESPONSE step from messages.
 */
export function prepareResponseScoringData(query: string, responseContent: string): ScoringData {
  console.log("[v0] SERVER prepareResponseFromMessages:", {
    responseContentLength: responseContent.length,
  })
  console.log("[v0] SERVER prepareResponseFromMessages - FULL INPUT:", JSON.stringify(query, null, 2))
  console.log("[v0] SERVER prepareResponseFromMessages - FULL OUTPUT:", responseContent)
  return {
    input: JSON.stringify(responseContent),
    output: responseContent,
  }
}

/**
 * Prepares scoring data for an ACTION step from messages.
 */
export function prepareActionFromMessages(precedingMessages: any[], toolName: string, toolInput: any): ScoringData {
  console.log("[v0] SERVER prepareActionFromMessages:", {
    toolName,
    precedingMessagesCount: precedingMessages.length,
  })
  console.log("[v0] SERVER prepareActionFromMessages - FULL INPUT:", JSON.stringify(precedingMessages, null, 2))
  console.log("[v0] SERVER prepareActionFromMessages - FULL OUTPUT:", JSON.stringify({ toolName, toolInput }, null, 2))
  return {
    input: JSON.stringify(precedingMessages),
    output: JSON.stringify({ toolName, toolInput }),
  }
}

/**
 * Prepares scoring data for an OBSERVATION step from messages.
 */
export function prepareObservationFromMessages(toolName: string, toolInput: any, toolOutput: any): ScoringData {
  console.log("[v0] SERVER prepareObservationFromMessages:", { toolName })
  console.log(
    "[v0] SERVER prepareObservationFromMessages - FULL INPUT:",
    JSON.stringify({ toolName, toolInput }, null, 2),
  )
  console.log("[v0] SERVER prepareObservationFromMessages - FULL OUTPUT:", JSON.stringify(toolOutput, null, 2))
  return {
    input: JSON.stringify({ toolName, toolInput }),
    output: JSON.stringify(toolOutput),
  }
}

/**
 * Prepares scoring data for a THINKING step from messages.
 */
export function prepareThinkingFromMessages(precedingMessages: any[], thinkingContent: string): ScoringData {
  console.log("[v0] SERVER prepareThinkingFromMessages:", {
    precedingMessagesCount: precedingMessages.length,
    thinkingContentLength: thinkingContent.length,
  })
  console.log("[v0] SERVER prepareThinkingFromMessages - FULL INPUT:", JSON.stringify(precedingMessages, null, 2))
  console.log("[v0] SERVER prepareThinkingFromMessages - FULL OUTPUT:", thinkingContent)
  return {
    input: JSON.stringify(precedingMessages),
    output: thinkingContent,
  }
}
