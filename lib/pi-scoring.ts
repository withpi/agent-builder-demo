import PiClient from "withpi"

export interface RubricCriteria {
  id: string
  criteria: string
  description: string
  traceType: "thinking" | "action" | "observation" | "final" | "general"
  toolName?: string | null
}

export interface RubricScore {
  rubricItemId: string
  score: number
}

/**
 * Centralized Pi scoring function that handles both real Pi scoring and fallback mock scoring
 */
export async function scoreTraceStep(
  traceContent: string,
  traceType: "thinking" | "action" | "observation" | "final",
  rubricCriteria: RubricCriteria[]
): Promise<RubricScore[]> {
  // Filter criteria that apply to this trace type
  const relevantCriteria = rubricCriteria.filter(criteria => 
    criteria.traceType === traceType || criteria.traceType === "general"
  )
  
  if (relevantCriteria.length === 0) {
    return []
  }

  // Try Pi scoring first
  if (process.env.WITHPI_API_KEY) {
    try {
      const pi = new PiClient({ apiKey: process.env.WITHPI_API_KEY })
      const scoringSpec = relevantCriteria.map(criteria => ({
        question: criteria.description
      }))
      
      const scores = await pi.scoringSystem.score({
        llm_input: traceContent,
        llm_output: traceContent,
        scoring_spec: scoringSpec,
      })
      
      if (scores?.question_scores) {
        // Process Pi scores and map to rubric criteria
        const processedScores = processPiScores(scores, relevantCriteria)
        
        // Detailed logging of PI scoring input and output
        console.log("\n" + "=".repeat(80))
        console.log("🎯 PI SCORING RESULTS")
        console.log("=".repeat(80))
        console.log(`📝 Trace Type: ${traceType.toUpperCase()}`)
        console.log(`📏 Content Length: ${traceContent.length} characters`)
        console.log(`🔍 Criteria Count: ${relevantCriteria.length}`)
        console.log("")
        
        console.log("📥 INPUT TO PI SCORING:")
        console.log("-".repeat(40))
        console.log("📋 Scoring Specification:")
        relevantCriteria.forEach((criteria, index) => {
          console.log(`  ${index + 1}. ${criteria.criteria}`)
          console.log(`     Question: ${criteria.description}`)
          console.log(`     Type: ${criteria.traceType}${criteria.toolName ? ` (${criteria.toolName})` : ''}`)
        })
        console.log("")
        console.log("📄 Content to Score:")
        console.log(`"${traceContent.length > 200 ? traceContent.substring(0, 200) + '...' : traceContent}"`)
        console.log("")
        
        console.log("📤 OUTPUT FROM PI SCORING:")
        console.log("-".repeat(40))
        console.log("🔢 Raw Scores from Pi API:")
        if (typeof scores.question_scores === 'object' && !Array.isArray(scores.question_scores)) {
          Object.entries(scores.question_scores).forEach(([question, score], index) => {
            console.log(`  ${index + 1}. "${question}": ${score}`)
          })
        } else if (Array.isArray(scores.question_scores)) {
          scores.question_scores.forEach((scoreDetail: any, index: number) => {
            console.log(`  ${index + 1}. Score: ${scoreDetail.score}/${scoreDetail.max_score} (${((scoreDetail.score / scoreDetail.max_score) * 100).toFixed(1)}%)`)
          })
        }
        console.log("")
        
        console.log("🎯 PROCESSED SCORES:")
        console.log("-".repeat(40))
        processedScores.forEach((score, index) => {
          const criteria = relevantCriteria.find(c => c.id === score.rubricItemId)
          const criteriaName = criteria ? criteria.criteria : `Unknown Criteria`
          console.log(`  ${index + 1}. ${criteriaName}: ${score.score.toFixed(2)} (${(score.score * 100).toFixed(1)}%)`)
        })
        console.log("")
        
        const avgScore = processedScores.reduce((sum, s) => sum + s.score, 0) / processedScores.length
        console.log(`📊 Average Score: ${avgScore.toFixed(2)} (${(avgScore * 100).toFixed(1)}%)`)
        console.log("=".repeat(80) + "\n")
        
        return processedScores
      }
    } catch (error) {
      console.error("[Pi Scoring] Error calling Pi API:", error)
    }
  }

  // Fallback to mock scores
  console.log(`[Pi Scoring] Using mock scores for ${traceType} step (${relevantCriteria.length} criteria)`)
  return generateMockScores(relevantCriteria)
}

/**
 * Process Pi API scores and map them to rubric criteria
 */
function processPiScores(scores: any, criteria: RubricCriteria[]): RubricScore[] {
  if (scores.question_scores && typeof scores.question_scores === 'object') {
    // Handle object format: { 'question': score }
    return Object.entries(scores.question_scores).map(([question, score], index) => ({
      rubricItemId: criteria[index]?.id || `rubric-${index}`,
      score: typeof score === 'number' ? parseFloat(score.toFixed(2)) : 0.5
    }))
  } else if (scores.question_scores && Array.isArray(scores.question_scores)) {
    // Handle array format: [{ score, max_score }]
    return scores.question_scores.map((scoreDetail: any, index: number) => ({
      rubricItemId: criteria[index]?.id || `rubric-${index}`,
      score: scoreDetail.score ? parseFloat((scoreDetail.score / scoreDetail.max_score).toFixed(2)) : 0.5
    }))
  }
  
  // Invalid structure, return mock scores
  return generateMockScores(criteria)
}

/**
 * Generate mock scores for demonstration purposes
 */
function generateMockScores(criteria: RubricCriteria[]): RubricScore[] {
  return criteria.map(criteria => ({
    rubricItemId: criteria.id,
    score: Math.round((Math.random() * 0.8 + 0.1) * 100) / 100
  }))
}
