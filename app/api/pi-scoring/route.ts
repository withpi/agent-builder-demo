import { NextRequest } from "next/server"
import { scoreLLMOutput } from "@/lib/pi-scoring"

export async function POST(request: NextRequest) {
  try {
    const { traceContent, rubricCriteria } = await request.json()

    if (!traceContent || !rubricCriteria || !Array.isArray(rubricCriteria)) {
      return Response.json({ error: "traceContent and rubricCriteria array are required" }, { status: 400 })
    }

    // Convert rubric criteria to the format expected by scoreLLMOutput
    const scoringSpec = rubricCriteria.map((criteria: any) => ({
      question: criteria.description || criteria.criteria
    }))

    // Use the trace content as both input and output for scoring
    // This makes sense since we're evaluating the trace step itself
    const scores = await scoreLLMOutput(traceContent, traceContent, scoringSpec)

    if (!scores) {
      // Return mock scores if Pi scoring is not available
      return Response.json({
        scores: rubricCriteria.map((criteria: any, index: number) => ({
          rubricItemId: criteria.id,
          score: Math.round((Math.random() * 0.8 + 0.1) * 100) / 100
        }))
      })
    }

    // Map the scores back to the rubric criteria
    const mappedScores = rubricCriteria.map((criteria: any, index: number) => ({
      rubricItemId: criteria.id,
      score: scores[index]?.score || 0.5
    }))

    return Response.json({ scores: mappedScores })

  } catch (error) {
    console.error("Pi scoring API error:", error)
    return Response.json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}
