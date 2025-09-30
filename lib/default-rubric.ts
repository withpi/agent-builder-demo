import { EvaluationRubricItem } from "./types"

export const DEFAULT_EVALUATION_RUBRIC: EvaluationRubricItem[] = [
  {
    id: "tool-call",
    criteria: "Tool Call",
    description: "Does this step call a tool?",
    traceType: "general",
    toolName: null,
    timestamp: new Date()
  },
  {
    id: "error-in-final-response",
    criteria: "Error in final response",
    description: "Does this step mention an error?",
    traceType: "final",
    toolName: null,
    timestamp: new Date()
  }
]
