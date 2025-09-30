export interface EvaluationRubricItem {
  id: string
  criteria: string
  description: string
  traceType: "thinking" | "action" | "observation" | "final" | "general"
  toolName: string | null
  timestamp: Date
}


