import type { NextRequest } from "next/server"

const SYSTEM_PROMPT = `You are an expert at analyzing feedback annotations and converting them into clear, actionable evaluation criteria for AI agents.

Your task is to take a feedback annotation and transform it into:
1. A simple yes/no question that reframes the annotation into a rule
2. A concise criteria name that summarizes the rule
3. The tool name that the feedback relates to (if any)

Guidelines:
- The yes/no question should be phrased as "Does the agent [positive action]?" or "Does the agent avoid [negative action]?"
- Make the question specific and testable
- The criteria name should be 3-6 words that capture the essence of the rule
- Focus on observable behaviors and actions
- Avoid vague or subjective language
- If the feedback relates to a specific tool (like search_countries, calculator, etc.), identify that tool name
- If no specific tool is mentioned, use null for the toolName field

Examples:
- Annotation: "we don't have a tool that supports finding locations"
- Question: "Does the agent avoid suggesting or trying to call a tool to find an exact location?"
- Criteria Name: "Avoids Location Tools"
- Tool Name: null

- Annotation: "the agent should be more helpful and provide step-by-step guidance"
- Question: "Does the agent provide clear, step-by-step guidance when helping users?"
- Criteria Name: "Provides Step-by-Step Guidance"
- Tool Name: null

- Annotation: "the country search tool should return more detailed results"
- Question: "Does the agent use the country search tool effectively to provide detailed results?"
- Criteria Name: "Effective Country Search Usage"
- Tool Name: "search_countries"

Return your response as a JSON object with "question", "criteriaName", and "toolName" fields.`

export async function POST(request: NextRequest) {
  try {
    const { feedbackAnnotation } = await request.json()

    if (!feedbackAnnotation) {
      return Response.json({ error: "Feedback annotation is required" }, { status: 400 })
    }

    // Call OpenAI to transform the annotation
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: `Please transform this feedback annotation into a yes/no question and criteria name:\n\n"${feedbackAnnotation}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 200
      })
    })

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`)
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices[0]?.message?.content

    if (!content) {
      throw new Error("No content received from OpenAI")
    }

    // Parse the JSON response from OpenAI
    let parsedContent
    try {
      parsedContent = JSON.parse(content)
    } catch (parseError) {
      // If JSON parsing fails, create a fallback response
      parsedContent = {
        question: `Does the agent follow the guideline: "${feedbackAnnotation}"?`,
        criteriaName: "Follows Guidelines",
        toolName: null
      }
    }

    const result = {
      question: parsedContent.question,
      criteriaName: parsedContent.criteriaName,
      toolName: parsedContent.toolName || null,
      originalAnnotation: feedbackAnnotation,
      systemPrompt: SYSTEM_PROMPT,
      timestamp: new Date().toISOString()
    }

    return Response.json(result)
  } catch (error) {
    console.error("Feedback helper API error:", error)
    return Response.json({ 
      error: error instanceof Error ? error.message : "Unknown error",
      systemPrompt: SYSTEM_PROMPT 
    }, { status: 500 })
  }
}
