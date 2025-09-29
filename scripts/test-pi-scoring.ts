import PiClient from "withpi"

export async function scoreLLMOutput(llmInput: string, llmOutput: string, scoringSpec: Array<{ question: string }>) {
  try {
    const pi = new PiClient({ apiKey: process.env.WITHPI_API_KEY })
    const scores = await pi.scoringSystem.score({
      llm_input: llmInput,
      llm_output: llmOutput,
      scoring_spec: scoringSpec,
    })
    console.log(
      `[Pi Score] Input: "${llmInput.substring(0, 50)}..." | Output: "${llmOutput.substring(0, 50)}..." | Score: ${scores.total_score}`,
    )
    return scores
  } catch (error) {
    console.error("[Pi Score] Error:", error instanceof Error ? error.message : "Unknown error")
    return null
  }
}

// Example usage (can be run directly)
if (import.meta.url === `file://${process.argv[1]}`) {
  const scores = await scoreLLMOutput("Pi Labs", "Score anything with Pi Labs today!", [
    { question: "Is there a strong call to action?" },
  ])
  if (scores) {
    console.log("Total score:", scores.total_score)
  }
}
