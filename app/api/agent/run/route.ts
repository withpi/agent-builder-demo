import { createOpenAI } from "@ai-sdk/openai"
import {streamText, stepCountIs, ModelMessage} from "ai"
import { NextResponse } from "next/server"
import { getScoredData } from "@/lib/rubric/rubricActions"
import {
  prepareActionFromMessages,
  prepareObservationFromMessages,
  prepareResponseScoringData,
  prepareThinkingFromMessages, // Added import for thinking helper
} from "@/lib/utils/scoring-utils"
import { waitUntil } from "@vercel/functions"
import {AVAILABLE_TOOLS} from "@/lib/tools";

export const maxDuration = 60

const openai = createOpenAI({
  apiKey: process.env.OPEN_AI_KEY,
})

function cleanMessagesForScoring(messages: any[]): any[] {
  return messages.map((msg) => {
    if (!msg.content || !Array.isArray(msg.content)) {
      return msg
    }

    return {
      ...msg,
      content: msg.content.map((part: any) => {
        const { providerOptions, ...cleanPart } = part
        return cleanPart
      }),
    }
  })
}

function filterTools(toolSlugs: keyof typeof AVAILABLE_TOOLS) {
  return Object.fromEntries(Object.entries(AVAILABLE_TOOLS).filter(([k, v]) => toolSlugs.includes(k)))
}

export async function POST(req: Request) {
  try {
    const { config, input, traceId, externalUserId, toolNames, usePiJudge, rubrics } = await req.json()

    console.log("[v0] Starting agent with config:", {
      model: config.model,
      toolNames: toolNames,
      externalUserId,
      usePiJudge,
      rubricsCount: rubrics?.length || 0,
    })

    console.log("[v0] Filtering tools for", toolNames);
    const validTools = filterTools(toolNames);

    const encoder = new TextEncoder()
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    waitUntil(
      (async () => {
        try {
          const maxSteps = 10
          const maxResponseRetries = 5 // Limit retries to avoid infinite loops
          let responseRetryCount = 0
          let shouldRetryResponse = false
          let responseFeedback = ""
          let conversationMessages: any[] = [{ role: "user", content: input }] // Initialize conversationMessages with the user input so it's available for response scoring
          let currentMessages: any[] = [] // Add variable to track current messages from the stream

          do {
            shouldRetryResponse = false
            console.log("[v0] Total tools available:", Object.keys(validTools).length)

            const rubricsByToolCall = new Map()
            const rubricsByToolResult = new Map()
            const rubricsByThinking = new Map()
            let responseRubric: any = null

            if (usePiJudge && rubrics && rubrics.length > 0) {
              rubrics.forEach((rubric: any) => {
                if (rubric.rubricType === "tool-call") {
                  rubricsByToolCall.set(rubric.toolName, rubric)
                } else if (rubric.rubricType === "tool-result") {
                  rubricsByToolResult.set(rubric.toolName, rubric)
                } else if (rubric.rubricType === "thinking") {
                  rubricsByThinking.set(rubric.toolName || "default", rubric)
                } else if (rubric.rubricType === "response") {
                  responseRubric = rubric
                }
              })
              console.log("[v0] Rubric enforcement enabled:", {
                toolCallRubrics: rubricsByToolCall.size,
                toolResultRubrics: rubricsByToolResult.size,
                thinkingRubrics: rubricsByThinking.size,
                hasResponseRubric: !!responseRubric,
              })
            }

            const systemPrompt = config.systemPrompt

            const result = streamText({
              model: openai(config.model),
              system: systemPrompt,
              prompt: responseFeedback ? undefined : input,
              messages: responseFeedback ? conversationMessages : undefined,
              tools: validTools,
              stopWhen: stepCountIs(maxSteps),
              prepareStep: async ({ steps, stepNumber, model, messages }) => {
                const lastStep = steps[steps.length - 1]
                currentMessages = messages
                console.log("[v0] prepareStep called:", {
                  stepNumber,
                  stepsCount: steps.length,
                  finishReason: lastStep?.finishReason,
                })

                if (!usePiJudge || !rubrics || rubrics.length === 0) {
                  return { messages }
                }
                // Inject response feedback if present in the first step number
                if (stepNumber == 0 || steps.length === 0) {
                  if (responseFeedback) {
                    return {messages: [...messages, {
                      role: 'user',
                      content: responseFeedback
                    }]}
                  }
                  return { messages }
                }

                const failedChecks: Array<{
                  toolName: string
                  rubricType: string
                  score: number
                  threshold: number
                  lowScoringCriteria: string[]
                }> = []

                if (Array.isArray(lastStep.content) && rubricsByThinking.size > 0) {
                  const textParts = lastStep.content.filter((part: any) => part.type === "text")

                  if (textParts.length > 0) {
                    console.log("[v0] Found", textParts.length, "thinking steps in lastStep.content")

                    for (const textPart of textParts) {
                      const thinkingRubric = rubricsByThinking.get("default")

                      if (thinkingRubric) {
                        console.log("[v0] Scoring thinking step")

                        // Find the index of the current step in messages
                        const currentStepIndex = messages.findIndex(
                          (msg: any) =>
                            msg.role === "assistant" &&
                            Array.isArray(msg.content) &&
                            msg.content.some((item: any) => item.type === "text" && item.text === textPart.text),
                        )

                        const messagesBeforeThinking = currentStepIndex >= 0 ? messages.slice(0, currentStepIndex) : []

                        const cleanedMessages = cleanMessagesForScoring(messagesBeforeThinking)
                        const scoringData = prepareThinkingFromMessages(cleanedMessages, textPart.text)

                        try {
                          const scoredData = await getScoredData([scoringData], thinkingRubric.questions)

                          if (scoredData.length > 0) {
                            const scoreResult = scoredData[0]
                            const threshold = thinkingRubric.threshold || 0.5
                            console.log("[v0] Thinking score:", scoreResult.score, "Threshold:", threshold)

                            if (scoreResult.score < threshold) {
                              const lowScoringCriteria = scoreResult.questionScores
                                .filter((qs: any) => qs.score < threshold)
                                .map((qs: any) => {
                                  const question = thinkingRubric.questions.find((q: any) => q.label === qs.label)
                                  return `  - ${question?.question || qs.label}: ${Math.round(qs.score * 100)}%`
                                })

                              failedChecks.push({
                                toolName: "thinking",
                                rubricType: "thinking",
                                score: scoreResult.score,
                                threshold,
                                lowScoringCriteria,
                              })
                            }
                          }
                        } catch (error) {
                          console.error("[v0] Error scoring thinking step:", error)
                        }
                      }
                    }
                  }
                }

                if (lastStep.toolCalls && lastStep.toolCalls.length > 0) {
                  console.log("[v0] Checking tool-call rubrics for", lastStep.toolCalls.length, "tool calls")

                  for (const toolCall of lastStep.toolCalls) {
                    const toolName = toolCall.toolName

                    const rubricToCheck = rubricsByToolCall.get(toolName)

                    if (rubricToCheck) {
                      console.log("[v0] Scoring tool-call rubric for:", toolName)

                      const toolCallIndex = messages.findIndex(
                        (msg: any) =>
                          msg.role === "assistant" &&
                          Array.isArray(msg.content) &&
                          msg.content.some(
                            (item: any) => item.type === "tool-call" && item.toolCallId === toolCall.toolCallId,
                          ),
                      )

                      // Get messages up to but not including the tool call
                      const messagesBeforeToolCall = toolCallIndex >= 0 ? messages.slice(0, toolCallIndex) : []

                      const cleanedMessages = cleanMessagesForScoring(messagesBeforeToolCall)
                      const scoringData = prepareActionFromMessages(cleanedMessages, toolCall.toolName, toolCall.input)

                      console.log("[v0] Tool-call scoring input (messages before tool call):", scoringData.input)
                      console.log("[v0] Tool-call scoring output:", scoringData.output)

                      try {
                        const scoredData = await getScoredData([scoringData], rubricToCheck.questions)

                        if (scoredData.length > 0) {
                          const scoreResult = scoredData[0]
                          const threshold = rubricToCheck.threshold || 0.5
                          console.log("[v0] Tool-call score:", scoreResult.score, "Threshold:", threshold)

                          if (scoreResult.score < threshold) {
                            const lowScoringCriteria = scoreResult.questionScores
                              .filter((qs: any) => qs.score < threshold)
                              .map((qs: any) => {
                                const question = rubricToCheck.questions.find((q: any) => q.label === qs.label)
                                return `  - ${question?.question || qs.label}: ${Math.round(qs.score * 100)}%`
                              })

                            failedChecks.push({
                              toolName,
                              rubricType: "tool-call",
                              score: scoreResult.score,
                              threshold,
                              lowScoringCriteria,
                            })
                          }
                        }
                      } catch (error) {
                        console.error("[v0] Error scoring tool-call:", error)
                      }
                    }
                  }
                }

                if (lastStep.toolResults && lastStep.toolResults.length > 0) {
                  console.log("[v0] Checking tool-result rubrics for", lastStep.toolResults.length, "tool results")

                  for (const toolResult of lastStep.toolResults) {
                    const toolName = toolResult.toolName
                    const rubricToCheck = rubricsByToolResult.get(toolName)

                    if (rubricToCheck) {
                      console.log("[v0] Scoring tool-result rubric for:", toolName)

                      const correspondingCall = lastStep.toolCalls?.find(
                        (tc: any) => tc.toolCallId === toolResult.toolCallId,
                      )

                      if (correspondingCall) {
                        const scoringData = prepareObservationFromMessages(
                          correspondingCall.toolName,
                          correspondingCall.input,
                          toolResult.output,
                        )

                        try {
                          const scoredData = await getScoredData([scoringData], rubricToCheck.questions)

                          if (scoredData.length > 0) {
                            const scoreResult = scoredData[0]
                            const threshold = rubricToCheck.threshold || 0.5
                            console.log("[v0] Tool-result score:", scoreResult.score, "Threshold:", threshold)

                            if (scoreResult.score < threshold) {
                              const lowScoringCriteria = scoreResult.questionScores
                                .filter((qs: any) => qs.score < threshold)
                                .map((qs: any) => {
                                  const question = rubricToCheck.questions.find((q: any) => q.label === qs.label)
                                  return `  - ${question?.question || qs.label}: ${Math.round(qs.score * 100)}%`
                                })

                              failedChecks.push({
                                toolName,
                                rubricType: "tool-result",
                                score: scoreResult.score,
                                threshold,
                                lowScoringCriteria,
                              })
                            }
                          }
                        } catch (error) {
                          console.error("[v0] Error scoring tool-result:", error)
                        }
                      }
                    }
                  }
                }

                if (failedChecks.length > 0) {
                  console.log("[v0] Found", failedChecks.length, "failed rubric checks, injecting feedback")

                  const feedbackSections = failedChecks
                    .map((check, index) => {
                      const criteriaList = check.lowScoringCriteria.join("\n")
                      return `**Issue ${index + 1}: ${check.toolName}** (${check.rubricType})
- Current score: ${Math.round(check.score * 100)}% (Required: ${Math.round(check.threshold * 100)}%)
- Quality gaps identified:
${criteriaList}

**Required Action**: You MUST revise your ${check.rubricType === "thinking" ? "reasoning" : check.rubricType === "tool-call" ? "tool selection and parameters" : "interpretation of the tool result"} to address ALL of the above quality gaps before proceeding.`
                    })
                    .join("\n\n")

                  const feedbackMessage = `🚫 STOP - YOUR LAST ACTION WAS REJECTED

The system has blocked your previous step(s) because they failed quality standards. You CANNOT proceed until you fix these issues.

${feedbackSections}

**YOU MUST DO THIS NOW**:
1. Carefully review each quality gap listed above
2. Understand WHY each criterion failed (insufficient detail, incorrect approach, missing context, etc.)
3. Revise your approach to directly address EVERY failed criterion
4. Re-execute the corrected action(s)

DO NOT generate a final response. DO NOT proceed with different actions. You must RETRY the failed action(s) with corrections that address the specific quality gaps identified above.`

                  const feedbackStepId = `step-feedback-${Date.now()}-${Math.random()}`
                  await writer.write(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "step-start",
                        traceId,
                        stepId: feedbackStepId,
                        stepType: "FEEDBACK",
                      })}\n\n`,
                    ),
                  )

                  await writer.write(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "token",
                        traceId,
                        stepId: feedbackStepId,
                        delta: feedbackMessage,
                      })}\n\n`,
                    ),
                  )

                  await writer.write(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "step-end",
                        traceId,
                        stepId: feedbackStepId,
                      })}\n\n`,
                    ),
                  )

                  const modifiedMessages:ModelMessage[] = [
                    ...messages,
                    {
                      role: "user",
                      content: feedbackMessage,
                    },
                  ]

                  console.log("[v0] Injecting feedback as user message for maximum visibility")
                  return { messages: modifiedMessages }
                }

                return { messages }
              },
            })

            let currentStepId: string | null = null
            let currentStepType: string | null = null
            let hasToolCalls = false
            let lastToolResultTime = 0
            const toolCallsMap = new Map<string, { name: string; input: any }>()
            let currentStepText = ""

            for await (const chunk of result.fullStream) {
              if (chunk.type === "text-delta") {
                const stepType = "THINKING"
                currentStepText += chunk.text

                if (!currentStepId || currentStepType !== stepType) {
                  if (currentStepId) {
                    await writer.write(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "step-end",
                          traceId,
                          stepId: currentStepId,
                        })}\n\n`,
                      ),
                    )
                  }

                  currentStepId = `step-${Date.now()}-${Math.random()}`
                  currentStepType = stepType
                  currentStepText = chunk.text

                  await writer.write(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "step-start",
                        traceId,
                        stepId: currentStepId,
                        stepType,
                      })}\n\n`,
                    ),
                  )
                }

                await writer.write(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "token",
                      traceId,
                      stepId: currentStepId,
                      delta: chunk.text,
                    })}\n\n`,
                  ),
                )
              }

              if (chunk.type === "tool-call") {
                hasToolCalls = true
                const toolCallId = chunk.toolCallId
                const toolInput = chunk.input
                toolCallsMap.set(toolCallId, { name: chunk.toolName, input: toolInput })

                if (currentStepId) {
                  await writer.write(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "step-end",
                        traceId,
                        stepId: currentStepId,
                      })}\n\n`,
                    ),
                  )
                }

                currentStepText = ""
                currentStepId = `step-${Date.now()}-${Math.random()}`
                currentStepType = "ACTION"

                await writer.write(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "step-start",
                      traceId,
                      stepId: currentStepId,
                      stepType: "ACTION",
                      toolName: chunk.toolName,
                      toolInput: toolInput,
                      toolCallId: toolCallId,
                    })}\n\n`,
                  ),
                )

                await writer.write(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "token",
                      traceId,
                      stepId: currentStepId,
                      delta: `Executing: ${chunk.toolName}`,
                    })}\n\n`,
                  ),
                )

                await writer.write(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "step-end",
                      traceId,
                      stepId: currentStepId,
                    })}\n\n`,
                  ),
                )

                currentStepId = null
                currentStepType = null
              }

              if (chunk.type === "tool-result") {
                lastToolResultTime = Date.now()

                const toolCall = toolCallsMap.get(chunk.toolCallId)
                const toolOutput = chunk.output

                currentStepId = `step-${Date.now()}-${Math.random()}`
                currentStepType = "OBSERVATION"

                await writer.write(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "step-start",
                      traceId,
                      stepId: currentStepId,
                      stepType: "OBSERVATION",
                      toolName: toolCall?.name,
                      toolInput: toolCall?.input,
                      toolOutput: toolOutput,
                      toolCallId: chunk.toolCallId,
                    })}\n\n`,
                  ),
                )

                const observationContent = toolOutput
                  ? typeof toolOutput === "string"
                    ? toolOutput
                    : JSON.stringify(toolOutput, null, 2)
                  : "No output returned"

                await writer.write(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "token",
                      traceId,
                      stepId: currentStepId,
                      delta: observationContent,
                    })}\n\n`,
                  ),
                )

                await writer.write(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "step-end",
                      traceId,
                      stepId: currentStepId,
                    })}\n\n`,
                  ),
                )

                currentStepId = null
                currentStepType = null
                toolCallsMap.delete(chunk.toolCallId)
                currentStepText = ""
              }

              if (chunk.type === "finish") {
                if (currentStepId && currentStepType === "THINKING" && currentStepText) {
                  // This is a final response, not thinking - change the step type
                  await writer.write(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "step-type-change",
                        traceId,
                        stepId: currentStepId,
                        newStepType: "RESPONSE",
                      })}\n\n`,
                    ),
                  )

                  await writer.write(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "step-end",
                        traceId,
                        stepId: currentStepId,
                      })}\n\n`,
                    ),
                  )

                  currentStepId = null
                  currentStepType = null

                  if (responseRubric && currentStepText) {
                    console.log("[v0] Checking final response rubric")

                    try {
                      const scoringData = prepareResponseScoringData(input, currentStepText)

                      const scoredData = await getScoredData([scoringData], responseRubric.questions)

                      if (scoredData.length > 0) {
                        const scoreResult = scoredData[0]
                        const threshold = responseRubric.threshold || 0.5
                        console.log("[v0] Final response score:", scoreResult.score, "Threshold:", threshold)

                        if (scoreResult.score < threshold && responseRetryCount < maxResponseRetries) {
                          console.log(
                            `[v0] Final response failed rubric check, retrying (attempt ${responseRetryCount + 1}/${maxResponseRetries})`,
                          )

                          const lowScoringCriteria = scoreResult.questionScores
                            .filter((qs: any) => qs.score < threshold)
                            .map((qs: any, index: any) => {
                              const question = responseRubric.questions.find((q: any) => q.label === qs.label)
                              return `${index + 1}. ${question?.question || qs.label}
   - Current score: ${Math.round(qs.score * 100)}% (Required: ${Math.round(threshold * 100)}%)
   - Impact: This criterion is critical to response quality`
                            })

                          const feedbackMessage = `🚫 YOUR RESPONSE WAS REJECTED - IT DOES NOT MEET QUALITY STANDARDS

Your response scored ${Math.round(scoreResult.score * 100)}% but requires ${Math.round(threshold * 100)}% to pass.

**Why Your Response Failed**:
${lowScoringCriteria.join("\n\n")}

**WHAT YOU MUST DO NOW** (Attempt ${responseRetryCount + 1}/${maxResponseRetries}):

You must generate a COMPLETELY NEW response that directly fixes each deficiency above. Do not simply rephrase your previous response.

**Specific improvements required**:
- If clarity failed: Use simpler language, better structure, concrete examples
- If completeness failed: Add missing details, context, thorough explanations  
- If accuracy failed: Verify facts, correct errors, provide precise information
- If relevance failed: Focus directly on the user's specific question

Start your improved response immediately. Do not acknowledge this feedback, just provide the corrected response.`

                          const feedbackStepId = `step-feedback-${Date.now()}-${Math.random()}`
                          await writer.write(
                            encoder.encode(
                              `data: ${JSON.stringify({
                                type: "step-start",
                                traceId,
                                stepId: feedbackStepId,
                                stepType: "FEEDBACK",
                              })}\n\n`,
                            ),
                          )

                          await writer.write(
                            encoder.encode(
                              `data: ${JSON.stringify({
                                type: "token",
                                traceId,
                                stepId: feedbackStepId,
                                delta: feedbackMessage + "\n\n🔄 Regenerating response...",
                              })}\n\n`,
                            ),
                          )

                          await writer.write(
                            encoder.encode(
                              `data: ${JSON.stringify({
                                type: "step-end",
                                traceId,
                                stepId: feedbackStepId,
                              })}\n\n`,
                            ),
                          )

                          shouldRetryResponse = true
                          conversationMessages = [
                            ...currentMessages,
                            { role: "assistant", content: currentStepText },
                          ]
                          // Save the feedback so that its loaded in the next prepareStep (step = 0, responseRetryCount = responseRetryCount + 1)
                          responseFeedback = feedbackMessage
                          responseRetryCount++
                        } else if (scoreResult.score < threshold) {
                          console.log("[v0] Final response failed but max retries reached")
                        }
                      }
                    } catch (error) {
                      console.error("[v0] Error scoring final response:", error)
                    }
                  }
                } else if (currentStepId) {
                  await writer.write(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: "step-end",
                        traceId,
                        stepId: currentStepId,
                      })}\n\n`,
                    ),
                  )
                }

                if (!shouldRetryResponse) {
                  console.log("[v0] Agent completed")
                }
              }
            }
          } while (shouldRetryResponse)

          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "complete", traceId })}\n\n`))
        } catch (error) {
          console.error("[v0] Agent execution error:", error)
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                traceId,
                error: error instanceof Error ? error.message : "Unknown error",
              })}\n\n`,
            ),
          )
        } finally {
          await writer.close()
        }
      })(),
    )

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("[v0] API error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
