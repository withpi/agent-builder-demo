import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import type { NextRequest } from "next/server"
import { scoreLLMOutput } from "@/lib/pi-scoring"

export async function POST(request: NextRequest) {
  try {
    const { goal, model = "gpt-4o-mini", systemPrompt = "You are a helpful AI assistant." } = await request.json()

    if (!goal) {
      return Response.json({ error: "Goal is required" }, { status: 400 })
    }

    // Create a readable stream for real-time updates
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await executeAgentWithTools(goal, model, systemPrompt, controller, encoder)
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "final",
                content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
              })}\n\n`,
            ),
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

async function executeAgentWithTools(
  goal: string,
  model: string,
  systemPrompt: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  // Send initial thinking step
  const initialThinking = `Starting agent execution for goal: "${goal}". Let me analyze what needs to be done...`
  controller.enqueue(
    encoder.encode(
      `data: ${JSON.stringify({
        type: "thinking",
        content: initialThinking,
      })}\n\n`,
    ),
  )

  await delay(1000)

  const tools = {
    geocode: {
      description: "Get geographic coordinates and location information for a place name",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name, address, or location to geocode" },
        },
        required: ["location"],
      },
    },
    get_weather: {
      description: "Get weather information for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name or location to get weather information" },
        },
        required: ["location"],
      },
    },
    search: {
      description: "Search for information on a topic",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  }

  let stepCount = 0
  const maxSteps = 5
  let currentContext = `Goal: ${goal}`

  while (stepCount < maxSteps) {
    stepCount++

    // Send thinking step
    const thinkingContent = `Step ${stepCount}: Analyzing current situation and deciding next action...`
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "thinking",
          content: thinkingContent,
        })}\n\n`,
      ),
    )
    await delay(800)

    const promptText = `${systemPrompt}\n\nYou are working towards this goal: "${goal}"\n\nCurrent context: ${currentContext}\n\nAvailable tools:\n- geocode(location): Get geographic coordinates and location information for a place name\n- get_weather(location): Get weather information for a location\n- search(query): Search for information on a topic\n\nBased on the goal and current context, what should you do next?\n\nRespond in this exact format:\nREASONING: [Your reasoning for what to do next]\nACTION: [Either a tool call like "geocode(New York)" OR "COMPLETE" if goal is achieved]\n\nIf you believe the goal is complete or cannot be completed, use ACTION: COMPLETE`

    const { text } = await generateText({
      model: openai(model === "gpt-4" ? "gpt-4o" : model === "gpt-4-turbo" ? "gpt-4-turbo" : "gpt-4o-mini"),
      prompt: promptText,
    })

    // Parse the response
    const lines = text.split("\n")
    let reasoning = ""
    let action = ""

    for (const line of lines) {
      if (line.startsWith("REASONING:")) {
        reasoning = line.replace("REASONING:", "").trim()
      } else if (line.startsWith("ACTION:")) {
        action = line.replace("ACTION:", "").trim()
      }
    }

    // Send reasoning
    if (reasoning) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "thinking",
            content: reasoning,
          })}\n\n`,
        ),
      )
      await delay(600)
    }

    // Check if complete
    if (action === "COMPLETE") {
      const finalPrompt = `${systemPrompt}\n\nBased on the work completed for goal: "${goal}"\n\nContext: ${currentContext}\n\nProvide a concise summary of what was accomplished or why the goal cannot be completed.`

      const { text: finalResponse } = await generateText({
        model: openai(model === "gpt-4" ? "gpt-4o" : model === "gpt-4-turbo" ? "gpt-4-turbo" : "gpt-4o-mini"),
        prompt: finalPrompt,
      })

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "final",
            content: finalResponse,
          })}\n\n`,
        ),
      )
      break
    }

    // Execute action
    if (action) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "action",
            content: `Executing: ${action}`,
          })}\n\n`,
        ),
      )
      await delay(400)

      const result = await executeAction(action)

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "observation",
            content: result,
          })}\n\n`,
        ),
      )

      await scoreLLMOutput(`Goal: ${goal}\nAction: ${action}`, result, [
        { question: "Is the action result relevant to the goal?" },
        { question: "Does the result provide useful information?" },
      ])

      // Update context for next iteration
      currentContext += `\n\nStep ${stepCount}: Executed ${action}, Result: ${result}`
      await delay(800)
    }
  }

  if (stepCount >= maxSteps) {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "final",
          content: "Agent reached maximum steps limit. Execution complete.",
        })}\n\n`,
      ),
    )
  }
}

async function executeAction(action: string): Promise<string> {
  // Fixed regex to properly match parentheses using $$ and $$ to match literal parentheses
  const match = action.match(/(\w+)$$([^)]+)$$/)
  if (!match) {
    return `Invalid action format: ${action}`
  }

  const [, tool, input] = match
  const cleanInput = input.replace(/['"]/g, "").trim() // Remove quotes and trim whitespace

  switch (tool) {
    case "geocode":
      await delay(800)
      // Return mock geocoding data
      return `Geocoding results for "${cleanInput}":
1. ${cleanInput} - Coordinates: 37.7989, -122.4662
   Located in San Francisco, CA, United States
   Elevation: 150 feet above sea level`

    case "get_weather":
      await delay(800)
      return `Weather for "${cleanInput}":
Temperature: 68°F (20°C)
Conditions: Partly cloudy
Humidity: 65%
Wind: 12 mph from the west
Forecast: Pleasant conditions expected throughout the day`

    case "search":
      await delay(800)
      return `Search results for "${cleanInput}":
1. ${cleanInput} - Top result with relevant information
2. Related article about ${cleanInput}
3. Guide to ${cleanInput}`

    default:
      return `Unknown tool: ${tool}`
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
