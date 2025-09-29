import PiClient from "withpi"

export async function scoreLLMOutput(
  llmInput: string,
  llmOutput: string,
  scoringSpec: Array<{ question: string }>,
): Promise<void> {
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

    console.log(
      `[v0] Pi Score - Input: "${llmInput.substring(0, 50)}..." | Output: "${llmOutput.substring(0, 50)}..." | Score: ${scores.total_score}`,
    )
  } catch (error) {
    console.error("[v0] Error scoring LLM output:", error instanceof Error ? error.message : "Unknown error")
  }
}
