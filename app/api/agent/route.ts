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
  
  let totalTokens = 0

  const tools = {
    search_countries: {
      description: "Search for countries by name and get detailed information including capital, population, region, currencies, languages, and more",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Country name or partial name to search for" },
        },
        required: ["query"],
      },
    },
    get_exchange_rates: {
      description: "Get all exchange rates from a base currency to all supported currencies using the standard Exchange Rate API",
      parameters: {
        type: "object",
        properties: {
          baseCurrency: { type: "string", description: "Base currency code (e.g., USD, EUR, GBP). Defaults to USD if not provided." },
        },
        required: [],
      },
    },
    convert_currency_pair: {
      description: "Convert between two specific currencies with optional amount calculation",
      parameters: {
        type: "object",
        properties: {
          baseCurrency: { type: "string", description: "Source currency code (e.g., USD, EUR, GBP)" },
          targetCurrency: { type: "string", description: "Target currency code (e.g., USD, EUR, GBP)" },
          amount: { type: "string", description: "Optional amount to convert (e.g., '100.50'). If provided, returns both exchange rate and converted amount." },
        },
        required: ["baseCurrency", "targetCurrency"],
      },
    },
  }

  let stepCount = 0
  const maxSteps = 5
  let currentContext = `Goal: ${goal}`

  while (stepCount < maxSteps) {
    stepCount++

    // Log step start
    console.log(`\n🚀 Starting step ${stepCount}/${maxSteps}`)
    console.log(`   Current context: ${currentContext.substring(0, 150)}${currentContext.length > 150 ? '...' : ''}`)

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

    const promptText = `${systemPrompt}\n\nYou are working towards this goal: "${goal}"\n\nCurrent context: ${currentContext}\n\nAvailable tools:\n- search_countries(query): Search for countries by name and get detailed information including capital, population, region, currencies, languages, and more\n- get_exchange_rates(baseCurrency): Get all exchange rates from a base currency to all supported currencies (defaults to USD)\n- convert_currency_pair(baseCurrency,targetCurrency,amount): Convert between two specific currencies with optional amount calculation\n\nBased on the goal and current context, what should you do next?\n\nRespond in this exact format:\nREASONING: [Your reasoning for what to do next]\nACTION: [Either a tool call like "search_countries(United States)" or "get_exchange_rates(USD)" or "convert_currency_pair(USD,EUR,100)" OR "COMPLETE" if goal is achieved]\n\nIf you believe the goal is complete or cannot be completed, use ACTION: COMPLETE`

    const { text, usage } = await generateText({
      model: openai(model === "gpt-4" ? "gpt-4o" : model === "gpt-4-turbo" ? "gpt-4-turbo" : "gpt-4o-mini"),
      prompt: promptText,
    })
    
    if (usage && usage.totalTokens) {
      totalTokens += usage.totalTokens
    }

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

      const { text: finalResponse, usage: finalUsage } = await generateText({
        model: openai(model === "gpt-4" ? "gpt-4o" : model === "gpt-4-turbo" ? "gpt-4-turbo" : "gpt-4o-mini"),
        prompt: finalPrompt,
      })
      
      if (finalUsage && finalUsage.totalTokens) {
        totalTokens += finalUsage.totalTokens
      }

      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            type: "final",
            content: finalResponse,
            metadata: {
              totalTokens: totalTokens,
              steps: stepCount
            }
          })}\n\n`,
        ),
      )
      
      // Log final step completion
      console.log(`🎯 Final step ${stepCount} completed - Agent execution finished`)
      console.log(`   Total steps: ${stepCount}`)
      console.log(`   Total tokens: ${totalTokens}`)
      console.log(`   Final response: ${finalResponse.substring(0, 100)}${finalResponse.length > 100 ? '...' : ''}`)
      
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

      // Create detailed trace step information for scoring
      const traceStepInput = `Step ${stepCount}: ${reasoning}\nAction to execute: ${action}\nGoal: ${goal}\nCurrent context: ${currentContext}`
      const traceStepOutput = result
      
      const rubricScores = await scoreLLMOutput(traceStepInput, traceStepOutput, [
        { question: "Does this step call a tool?" }
      ])
      
      // Note: The rubric scores are returned but not currently used in the agent execution
      // They would be integrated into the trace creation in the frontend

      // Update context for next iteration
      currentContext += `\n\nStep ${stepCount}: Executed ${action}, Result: ${result}`
      
      // Log step completion
      console.log(`✅ Step ${stepCount} completed successfully`)
      console.log(`   Action: ${action}`)
      console.log(`   Result: ${result.substring(0, 100)}${result.length > 100 ? '...' : ''}`)
      console.log(`   Context updated for next iteration`)
      
      await delay(800)
    }
  }

  if (stepCount >= maxSteps) {
    controller.enqueue(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "final",
          content: "Agent reached maximum steps limit. Execution complete.",
          metadata: {
            totalTokens: totalTokens,
            steps: stepCount
          }
        })}\n\n`,
      ),
    )
    
    // Log maximum steps reached
    console.log(`⚠️  Maximum steps limit reached - Agent execution stopped`)
    console.log(`   Total steps: ${stepCount}/${maxSteps}`)
    console.log(`   Total tokens: ${totalTokens}`)
    console.log(`   Execution terminated due to step limit`)
  }
}

async function executeAction(action: string): Promise<string> {
  // Match tool calls with parentheses like "search_countries(Russia)" or "convert_currency_pair(USD,EUR,100)"
  const match = action.match(/(\w+)\(([^)]+)\)/)
  if (!match) {
    return `Invalid action format: ${action}`
  }

  const [, tool, input] = match
  const cleanInput = input.replace(/['"]/g, "").trim() // Remove quotes and trim whitespace

  switch (tool) {
    case "search_countries":
      try {
        await delay(800)
        
        // Call the country search API
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/country-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: cleanInput }),
        })

        if (!response.ok) {
          throw new Error(`Country search API error: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.countries.length === 0) {
          return `No countries found for "${cleanInput}". ${data.message || 'Please try a different search term.'}`
        }

        // Format the results
        let result = `Country search results for "${cleanInput}" (${data.total} found):\n\n`
        
        data.countries.forEach((country: any, index: number) => {
          result += `${index + 1}. ${country.flag} ${country.name} (${country.officialName})\n`
          result += `   Capital: ${country.capital}\n`
          result += `   Region: ${country.region}${country.subregion ? `, ${country.subregion}` : ''}\n`
          result += `   Population: ${country.population?.toLocaleString() || 'N/A'}\n`
          result += `   Area: ${country.area ? `${country.area.toLocaleString()} km²` : 'N/A'}\n`
          result += `   Country Code: ${country.cca2} (${country.cca3})\n`
          
          if (country.currencies.length > 0) {
            result += `   Currencies: ${country.currencies.map((c: any) => `${c.name} (${c.code})`).join(', ')}\n`
          }
          
          if (country.languages.length > 0) {
            result += `   Languages: ${country.languages.join(', ')}\n`
          }
          
          if (country.timezones.length > 0) {
            result += `   Timezones: ${country.timezones.slice(0, 3).join(', ')}${country.timezones.length > 3 ? '...' : ''}\n`
          }
          
          result += '\n'
        })

        return result.trim()

      } catch (error) {
        console.error('Country search error:', error)
        return `Error searching for countries: ${error instanceof Error ? error.message : 'Unknown error'}`
      }

    case "get_exchange_rates":
      try {
        await delay(800)
        
        // Parse base currency from input (default to USD if not provided)
        const baseCurrency = cleanInput || "USD"
        
        // Call the standard exchange rate API
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/exchange-rate-standard`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ baseCurrency }),
        })

        if (!response.ok) {
          throw new Error(`Exchange rate API error: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.error) {
          return `Error fetching exchange rates: ${data.error}${data.details ? ` - ${data.details}` : ''}`
        }

        // Format the results
        let result = `Exchange rates for ${data.baseCurrency} (${data.total} currencies available):\n`
        result += `Last updated: ${data.lastUpdate}\n\n`
        
        // Show some popular currencies first
        const popularCurrencies = ['EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR']
        const conversionRates = data.conversionRates
        
        result += `Popular currencies:\n`
        popularCurrencies.forEach(code => {
          if (conversionRates[code]) {
            result += `  ${code}: ${conversionRates[code]}\n`
          }
        })
        
        result += `\nAll available currencies:\n`
        Object.entries(conversionRates)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([code, rate]) => {
            result += `  ${code}: ${rate}\n`
          })

        return result.trim()

      } catch (error) {
        console.error('Exchange rate error:', error)
        return `Error fetching exchange rates: ${error instanceof Error ? error.message : 'Unknown error'}`
      }

    case "convert_currency_pair":
      try {
        await delay(800)
        
        // Parse parameters from input (format: "USD,EUR,100" or "USD,EUR")
        const params = cleanInput.split(',').map(p => p.trim())
        if (params.length < 2) {
          return `Invalid format. Expected: convert_currency_pair(baseCurrency,targetCurrency,amount) or convert_currency_pair(baseCurrency,targetCurrency)`
        }
        
        const baseCurrency = params[0]
        const targetCurrency = params[1]
        const amount = params[2] || undefined
        
        // Call the pair conversion exchange rate API
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/exchange-rate-pair`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ baseCurrency, targetCurrency, amount }),
        })

        if (!response.ok) {
          throw new Error(`Exchange rate API error: ${response.status}`)
        }

        const data = await response.json()
        
        if (data.error) {
          return `Error converting currency: ${data.error}${data.details ? ` - ${data.details}` : ''}`
        }

        // Format the results
        let result = `Currency conversion: ${data.baseCurrency} → ${data.targetCurrency}\n`
        result += `Exchange rate: 1 ${data.baseCurrency} = ${data.conversionRate} ${data.targetCurrency}\n`
        result += `Last updated: ${data.lastUpdate}\n`
        
        if (data.amount && data.conversionResult) {
          result += `\nConversion result: ${data.amount} ${data.baseCurrency} = ${data.conversionResult} ${data.targetCurrency}`
        }

        return result.trim()

      } catch (error) {
        console.error('Currency conversion error:', error)
        return `Error converting currency: ${error instanceof Error ? error.message : 'Unknown error'}`
      }

    default:
      return `Unknown tool: ${tool}`
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
