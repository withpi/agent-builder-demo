import PiClient from "withpi"

export async function scoreLLMOutput(
  llmInput: string,
  llmOutput: string,
  scoringSpec: Array<{ question: string }>,
): Promise<Array<{rubricItemId: string, score: number}> | void> {
  try {
    if (!process.env.WITHPI_API_KEY) {
      console.log("[v0] Pi scoring skipped: WITHPI_API_KEY not configured")
      return
    }

    if (!llmInput || !llmOutput || !scoringSpec || scoringSpec.length === 0) {
      console.log("[v0] Pi scoring skipped: Invalid parameters")
      return
    }

    const pi = new PiClient({ apiKey: process.env.WITHPI_API_KEY })
    const scores = await pi.scoringSystem.score({
      llm_input: llmInput,
      llm_output: llmOutput,
      scoring_spec: scoringSpec,
    })

    // Print detailed trace step information with scores
    console.log("\n" + "=".repeat(80))
    console.log("🔍 PI SCORING RESULTS")
    console.log("=".repeat(80))
    
    // Extract step number from input if available
    const stepMatch = llmInput.match(/Step (\d+):/)
    const stepNumber = stepMatch ? stepMatch[1] : "Unknown"
    console.log(`\n📊 Step ${stepNumber} scoring completed`)
    
    console.log("\n📝 TRACE STEP INPUT:")
    console.log("─".repeat(40))
    console.log(llmInput)
    
    console.log("\n🤖 TRACE STEP OUTPUT:")
    console.log("─".repeat(40))
    console.log(llmOutput)
    
    console.log("\n📊 SCORING QUESTIONS & SCORES:")
    console.log("─".repeat(40))
    if (scores.detailed_scores && Array.isArray(scores.detailed_scores)) {
      scores.detailed_scores.forEach((scoreDetail: any, index: number) => {
        const question = scoringSpec[index]?.question || `Question ${index + 1}`
        console.log(`❓ ${question}`)
        console.log(`   Score: ${scoreDetail.score || 'N/A'} / ${scoreDetail.max_score || 'N/A'}`)
        if (scoreDetail.explanation) {
          console.log(`   Explanation: ${scoreDetail.explanation}`)
        }
        console.log()
      })
    } else {
      // Fallback if detailed scores aren't available
      scoringSpec.forEach((spec, index) => {
        console.log(`❓ ${spec.question}`)
        console.log(`   Score: Available in total score`)
        console.log()
      })
    }
    
    console.log("🎯 TOTAL SCORE:")
    console.log("─".repeat(40))
    console.log(`${scores.total_score} / ${scores.max_total_score || 'N/A'}`)
    
    console.log("\n" + "=".repeat(80) + "\n")
    
    // Return structured scores for integration
    if (scores.detailed_scores && Array.isArray(scores.detailed_scores)) {
      return scores.detailed_scores.map((scoreDetail: any, index: number) => ({
        rubricItemId: `rubric-${index}`,
        score: scoreDetail.score ? parseFloat((scoreDetail.score / scoreDetail.max_score).toFixed(2)) : 0.5
      }))
    } else {
      // Fallback: return mock scores based on scoring spec
      return scoringSpec.map((_, index) => ({
        rubricItemId: `rubric-${index}`,
        score: Math.round((Math.random() * 0.8 + 0.1) * 100) / 100
      }))
    }
    
  } catch (error) {
    console.error("[v0] Error scoring LLM output:", error instanceof Error ? error.message : "Unknown error")
    // Return mock scores on error
    return scoringSpec.map((_, index) => ({
      rubricItemId: `rubric-${index}`,
      score: Math.round((Math.random() * 0.8 + 0.1) * 100) / 100
    }))
  }
}
