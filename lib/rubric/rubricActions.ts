"use server"

import PiClient from "withpi"
import { z } from "zod"
import Question = PiClient.Question

export interface GenerateScorerJobStatus {
  jobId: string
  state: "QUEUED" | "RUNNING" | "DONE" | "ERROR" | "CANCELLED"
  detailedStatus: GenerateScorerStatusMessage[]
  dimensions?: Question[]
  threshold: number | null
}

export type GenerateScorerStatusMessage = GenerateScorerSystemMessage | GenerateScorerUserMessage

// Used for debugging. Not intended for the user.
export interface GenerateScorerSystemMessage {
  target: "system"
  message: string
}

const zGenerateScorerSystemMessage = z.object({
  target: z.literal("system"),
  message: z.string(),
})

// Can be shown to the user.
export interface GenerateScorerUserMessage {
  target: "user"
  message: string
  // If present, is between 0 (just started) and 1 (complete).
  completion?: number
}

const zGenerateScorerUserMessage = z.object({
  target: z.literal("user"),
  message: z.string(),
  completion: z.number().optional(),
})

// Tries to parse out all of the status messages that conform to the structured
// scorer generation log format.
function parseDetailedStatus(detailedStatus: string[]): GenerateScorerStatusMessage[] {
  return detailedStatus
    .map((status) => {
      try {
        status = JSON.parse(status)
      } catch {
        return null
      }
      {
        const { success, data } = zGenerateScorerUserMessage.safeParse(status)
        if (success) return data
      }
      {
        const { success, data } = zGenerateScorerSystemMessage.safeParse(status)
        if (success) return data
      }
      return null
    })
    .filter((s) => s != null) as GenerateScorerStatusMessage[]
}

export interface RubricExample {
  llm_input: string // Changed from any to string - will be JSON stringified messages array
  llm_output: string // final response
}

export async function retrieveGenerateScorerJob(jobId: string): Promise<GenerateScorerJobStatus> {
  const client = new PiClient({
    apiKey: process.env.WITHPI_API_KEY,
  })
  const response = await client.scoringSystem.generate.retrieve(jobId)
  return {
    jobId: response.job_id,
    state: response.state,
    detailedStatus: parseDetailedStatus(response.detailed_status),
    dimensions: response.scoring_spec || [],
    threshold: response.threshold || null,
  }
}

export async function createRubric(
  appDesc: string,
  existingQuestions: Question[],
  goodExamples: RubricExample[],
  badExamples: RubricExample[],
): Promise<GenerateScorerJobStatus> {
  console.log(process.env.WITHPI_API_KEY)
  const client = new PiClient({
    apiKey: process.env.WITHPI_API_KEY,
  })

  const posExamples = goodExamples.map((ex) => ({
    llm_input: ex.llm_input,
    llm_output: ex.llm_output,
    score: 1,
  }))
  const negExamples = badExamples.map((ex) => ({
    llm_input: ex.llm_input,
    llm_output: ex.llm_output,
    score: 0,
  }))

  const job = await client.scoringSystem.generate.startJob({
    application_description: appDesc,
    examples: [...posExamples, ...negExamples],
    preference_examples: [],
    existing_questions: existingQuestions,
    num_questions: 10,
  })
  return {
    jobId: job.job_id,
    state: job.state,
    detailedStatus: parseDetailedStatus(job.detailed_status),
    dimensions: [],
    threshold: null,
  }
}

export async function cancelGenerateScorerJob(jobId: string): Promise<string> {
  const client = new PiClient({
    apiKey: process.env.WITHPI_API_KEY,
  })
  return client.scoringSystem.generate.cancel(jobId)
}

export async function getScoredData<T>(data: {input: string; output: string}[], rubric: Question[]) {
  const client = new PiClient({
    apiKey: process.env.WITHPI_API_KEY,
  });
  console.log(rubric);
  return Promise.all(
    data.map(async (d) => {
      const score = await client.scoringSystem.score({
        llm_input: d.input,
        llm_output: d.output,
        scoring_spec: rubric,
      })
      return {
        questionScores: Object.entries(score.question_scores).map(([key, value]) => ({ label: key, score: value })),
        score: score.total_score,
        data: d,
      }
    }),
  )
}
