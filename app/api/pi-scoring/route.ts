import { NextRequest } from "next/server"
import { scoreTraceStep, type RubricCriteria } from "@/lib/pi-scoring"

export async function POST(request: NextRequest) {
  try {
    const { traceContent, traceType, rubricCriteria } = await request.json()

    if (!traceContent || !traceType || !rubricCriteria || !Array.isArray(rubricCriteria)) {
      return Response.json({ 
        error: "traceContent, traceType, and rubricCriteria array are required" 
      }, { status: 400 })
    }

    const scores = await scoreTraceStep(traceContent, traceType, rubricCriteria)
    return Response.json({ scores })

  } catch (error) {
    console.error("[Pi Scoring API] Error:", error)
    return Response.json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}
