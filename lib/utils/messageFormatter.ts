import type { AgentStep } from "@/lib/agent-context"

/**
 * Converts AgentSteps to Vercel AI SDK Core Message format
 * https://sdk.vercel.ai/docs/reference/ai-sdk-core/model-message
 */
export function convertStepsToMessages(steps: AgentStep[], userPrompt?: string) {
  const messages: any[] = []

  if (userPrompt) {
    messages.push({
      role: "user",
      content: userPrompt,
    })
  }

  let i = 0
  while (i < steps.length) {
    const step = steps[i]

    if (step.type === "THINKING") {
      // Look ahead to see if there are ACTION steps immediately following
      let hasFollowingActions = false
      let j = i + 1
      while (j < steps.length && steps[j].type === "ACTION") {
        hasFollowingActions = true
        j++
      }

      if (hasFollowingActions) {
        // Combine THINKING text with ACTION tool calls into a single assistant message
        const content: any[] = []

        // Add thinking text
        if (step.content) {
          content.push({
            type: "text",
            text: step.content,
          })
        }

        // Add all following ACTION steps as tool calls
        i++ // Move past the THINKING step
        while (i < steps.length && steps[i].type === "ACTION") {
          const actionStep = steps[i]
          content.push({
            type: "tool-call",
            toolCallId: actionStep.toolCallId || actionStep.id,
            toolName: actionStep.toolName || "unknown",
            input: actionStep.toolInput || {},
          })
          i++
        }

        messages.push({
          role: "assistant",
          content,
        })
      } else {
        // Standalone THINKING step with no following actions - skip it
        // (These are internal reasoning steps, not part of the message history)
        i++
      }
      continue
    } else if (step.type === "ACTION") {
      // Group consecutive ACTION steps into a single assistant message
      const toolCalls: any[] = []

      while (i < steps.length && steps[i].type === "ACTION") {
        const actionStep = steps[i]
        toolCalls.push({
          type: "tool-call",
          toolCallId: actionStep.toolCallId || actionStep.id,
          toolName: actionStep.toolName || "unknown",
          input: actionStep.toolInput || {},
        })
        i++
      }

      messages.push({
        role: "assistant",
        content: toolCalls,
      })
    } else if (step.type === "OBSERVATION") {
      // Group consecutive OBSERVATION steps into a single tool message
      const toolResults: any[] = []

      while (i < steps.length && steps[i].type === "OBSERVATION") {
        const observationStep = steps[i]
        toolResults.push({
          type: "tool-result",
          toolCallId: observationStep.toolCallId || observationStep.id,
          toolName: observationStep.toolName || "unknown",
          output:
            typeof observationStep.toolOutput === "string"
              ? { type: "text", value: observationStep.toolOutput }
              : { type: "json", value: observationStep.toolOutput },
        })
        i++
      }

      messages.push({
        role: "tool",
        content: toolResults,
      })
    } else if (step.type === "RESPONSE") {
      // RESPONSE = assistant message with text content
      messages.push({
        role: "assistant",
        content: step.content,
      })
      i++
    } else {
      // Unknown step type, skip it
      i++
    }
  }

  return messages
}

/**
 * Formats messages for display/debugging
 */
export function formatMessagesForDisplay(messages: any[]): string {
  return JSON.stringify(messages, null, 2)
}
