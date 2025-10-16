"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import PiClient from "withpi"
import Question = PiClient.Question
import { transformFeedbackToQuestion } from "@/lib/rubric/feedbackToQuestion"
import { toast } from "@/hooks/use-toast"
import {
  prepareResponseFromSteps,
  prepareActionFromSteps,
  prepareObservationFromSteps,
  prepareThinkingFromSteps, prepareResponseScoringData, // Added import for prepareThinkingFromSteps
} from "@/lib/utils/scoring-utils"
import {AVAILABLE_TOOLS} from "@/lib/tools";
import {getScoredData} from "@/lib/rubric/rubricActions";
import {v4} from 'uuid';

export type StepType = "THINKING" | "ACTION" | "OBSERVATION" | "RESPONSE" | "FEEDBACK"

export type RubricCategory = "final-output" | "action-steps"

export type RubricType = "tool-call" | "tool-result" | "response" | "thinking"

export interface StepScore {
  rubricId: string
  total: number
  questionScores: Array<{ label: string; question: string; score: number }>
  timestamp: number
  isLoading?: boolean
}

export interface StepFeedback {
  id: string
  stepId: string
  stepType: StepType
  toolName?: string
  actionStepId?: string // For OBSERVATION feedback, this links to the ACTION step that triggered it
  rating: "up" | "down"
  description: string
  input: string // Stringified JSON of preceding messages or relevant input
  output: string // Stringified JSON of the step output
  timestamp: number
}

export interface AgentStep {
  id: string
  type: StepType
  content: string
  toolName?: string
  toolInput?: any
  toolOutput?: any
  toolCallId?: string // Links ACTION and OBSERVATION steps together
  providerOptions?: any // Added providerOptions to match AI SDK message format
  timestamp: number
  feedback?: StepFeedback // Keep for backward compatibility - will be the most recent feedback
  feedbacks?: StepFeedback[] // New array to store all feedback entries
  score?: StepScore | null // Added score field to store scoring results
}

export interface AgentTrace {
  id: string
  configId: string
  input: string
  steps: AgentStep[]
  status: "running" | "completed" | "error"
  createdAt: number
}

export interface AgentConfig {
  id: string
  model: "gpt-4o" | "gpt-4o-mini"
  systemPrompt: string
  toolSlugs: (keyof typeof AVAILABLE_TOOLS)[] // Tools in your tool.ts file
  usePiJudge: boolean // Whether Pi Judge guardrails are enabled
  rubricVersions?: Record<string, number> // Map of rubricId to version number when trace was created
  createdAt: number
}

export interface Rubric {
  id: string
  stepType: StepType
  category: RubricCategory
  rubricType: RubricType // Added to distinguish between tool call and tool result rubrics
  toolName?: string // For action steps, this identifies which tool the rubric is for
  version: number
  questions: Question[]
  feedbackCount: number
  createdAt: number
  isGenerating?: boolean
}

interface AgentContextType {
  configs: AgentConfig[]
  traces: AgentTrace[]
  rubrics: Rubric[]
  currentConfig: AgentConfig
  currentTrace: AgentTrace | null
  updateConfig: (id: string, updates: Partial<AgentConfig>) => void
  setCurrentConfig: (config: AgentConfig | null) => void
  findOrCreateConfig: (
    model: string,
    systemPrompt: string,
    toolNames: (keyof typeof AVAILABLE_TOOLS)[],
    usePiJudge: boolean,
    currentRubrics: Rubric[],
  ) => AgentConfig
  addTrace: (trace: Omit<AgentTrace, "id" | "createdAt">) => AgentTrace
  updateTrace: (id: string, updates: Partial<AgentTrace>) => void
  setCurrentTrace: (trace: AgentTrace | null) => void
  addStepToTrace: (traceId: string, step: Omit<AgentStep, "timestamp">) => void
  updateStepScore: (traceId: string, stepId: string, score: StepScore) => void // Added updateStepScore function to persist scores to both traces and currentTrace
  addFeedback: (traceId: string, stepId: string, feedback: Omit<StepFeedback, "id" | "timestamp">) => Promise<void>
  getFeedbackByStepType: (stepType: StepType) => StepFeedback[]
  getFeedbackByToolName: (toolName: string) => StepFeedback[]
  getFeedbackByToolNameAndType: (toolName: string, rubricType: "tool-call" | "tool-result") => StepFeedback[]
  getUniqueToolNames: () => string[]
  addRubric: (rubric: Omit<Rubric, "id" | "createdAt">) => Rubric
  updateRubric: (id: string, updates: Partial<Rubric>) => void
  deleteRubric: (id: string) => void
  getRubricsByStepType: (stepType: StepType) => Rubric[]
  getRubricsByToolNameAndType: (toolName: string, rubricType: "tool-call" | "tool-result") => Rubric[]
  scoreStep: (step: AgentStep, trace: AgentTrace, rubric?: Rubric) => Promise<StepScore | null>
  rescoreStepsForRubric: (rubric: Rubric) => Promise<void>
}

const AgentContext = createContext<AgentContextType | undefined>(undefined)

export function AgentProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [traces, setTraces] = useState<AgentTrace[]>([])
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [currentConfig, setCurrentConfig] = useState<AgentConfig>({
    id: v4(),
    model: 'gpt-4o',
    systemPrompt: `You are "Web Research Agent" — a precise, citation-focused assistant that helps users answer research questions by searching the web and summarizing credible sources.

=== Core Directives ===
1. **Search Smart**
   - Run focused, relevant web searches to find recent, authoritative information.
   - Prioritize official, primary, or expert sources.
   - For broad topics, cover multiple perspectives.

2. **Extract & Summarize**
   - Read key documents and extract only what's relevant.
   - Summarize concisely in your own words; quote briefly when needed.
   - Combine findings into clear sections (Overview, Key Findings, Citations).

3. **Cite Everything**
   - Every factual statement must have a traceable source.
   - Format: [Title — Site/Author, Date] (URL)
   - Never invent or misattribute citations.

4. **Adapt to the Query**
   - Fact-finding → concise verified answers.
   - Exploratory → structured summaries from multiple viewpoints.
   - Trend queries → highlight changes over time and recent data.
   - Document retrieval → provide ranked links with one-line rationales.

5. **Output Style**
   - Start with a short "Answer" summary.
   - Follow with "Key Findings" and "Evidence & Citations".
   - Use bullet points and headings for clarity.
   - Be neutral, current, and specific — no filler or speculation.

6. **Integrity**
   - If unsure, say so and suggest next steps.
   - Avoid unsafe or unverifiable content.
   - Be transparent about uncertainty and disagreement.

Your goal: find, distill, and clearly attribute the most relevant and reliable information from the web.`,
    toolSlugs: ['search_web_results', 'get_website_content'],
    usePiJudge: true,
    createdAt: Date.now(),
  })
  const [currentTrace, setCurrentTrace] = useState<AgentTrace | null>(null)

  const addConfig = (config: Omit<AgentConfig, "id" | "createdAt">) => {
    const newConfig: AgentConfig = {
      ...config,
      id: `config-${Date.now()}`,
      createdAt: Date.now(),
    }
    setConfigs((prev) => [...prev, newConfig])
    return newConfig
  }

  const updateConfig = (id: string, updates: Partial<AgentConfig>) => {
    // The configs array should only be modified when running the agent via findOrCreateConfig
    if (currentConfig?.id === id) {
      setCurrentConfig((prev) => (prev ? { ...prev, ...updates } : null))
    }
  }

  const findOrCreateConfig = (
    model: string,
    systemPrompt: string,
    toolSlugs: (keyof typeof AVAILABLE_TOOLS)[],
    usePiJudge: boolean,
    currentRubrics: Rubric[],
  ): AgentConfig => {
    // Build rubric versions map if guardrails are enabled
    const rubricVersions: Record<string, number> = {}
    if (usePiJudge) {
      currentRubrics.forEach((rubric) => {
        rubricVersions[rubric.id] = rubric.version
      })
    }

    // Check if a matching config already exists
    const matchingConfig = configs.find((config) => {
      // Must match all base properties
      const baseMatches =
        config.model === model &&
        config.systemPrompt === systemPrompt &&
        config.toolSlugs.length === toolSlugs.length &&
        config.toolSlugs.every((slug) => toolSlugs.includes(slug)) &&
        config.usePiJudge === usePiJudge

      if (!baseMatches) return false

      // If guardrails are disabled, just check base properties
      if (!usePiJudge) return true

      // If guardrails are enabled, check rubric versions match
      if (!config.rubricVersions) return false

      const configRubricIds = Object.keys(config.rubricVersions)
      const currentRubricIds = Object.keys(rubricVersions)

      return (
        configRubricIds.length === currentRubricIds.length &&
        configRubricIds.every((id) => config.rubricVersions![id] === rubricVersions[id])
      )
    })

    if (matchingConfig) {
      return matchingConfig
    }

    // Create new config if no match found
    return addConfig({
      model: model as "gpt-4o" | "gpt-4o-mini",
      systemPrompt,
      toolSlugs: toolSlugs,
      usePiJudge,
      rubricVersions: usePiJudge ? rubricVersions : undefined,
    })
  }

  const addTrace = (trace: Omit<AgentTrace, "id" | "createdAt">) => {
    const newTrace: AgentTrace = {
      ...trace,
      id: `trace-${Date.now()}`,
      createdAt: Date.now(),
    }
    setTraces((prev) => [...prev, newTrace])
    return newTrace
  }

  const updateTrace = (id: string, updates: Partial<AgentTrace>) => {
    setTraces((prev) => prev.map((trace) => (trace.id === id ? { ...trace, ...updates } : trace)))
  }

  const addStepToTrace = (traceId: string, step: Omit<AgentStep, "timestamp">) => {
    const newStep: AgentStep = {
      ...step,
      timestamp: Date.now(),
    }

    setTraces((prev) =>
      prev.map((trace) => (trace.id === traceId ? { ...trace, steps: [...trace.steps, newStep] } : trace)),
    )

    setCurrentTrace((prev) => {
      if (prev?.id === traceId) {
        return { ...prev, steps: [...prev.steps, newStep] }
      }
      return prev
    })
  }

  const updateStepScore = (traceId: string, stepId: string, score: StepScore) => {
    console.log("[v0] updateStepScore: Updating score for step", stepId, "in trace", traceId)

    setTraces((prev) =>
      prev.map((trace) =>
        trace.id === traceId
          ? {
              ...trace,
              steps: trace.steps.map((step) => (step.id === stepId ? { ...step, score } : step)),
            }
          : trace,
      ),
    )

    setCurrentTrace((prev) => {
      if (prev?.id === traceId) {
        return {
          ...prev,
          steps: prev.steps.map((step) => (step.id === stepId ? { ...step, score } : step)),
        }
      }
      return prev
    })
  }

  const addFeedback = async (traceId: string, stepId: string, feedback: Omit<StepFeedback, "id" | "timestamp">) => {
    const newFeedback: StepFeedback = {
      ...feedback,
      id: `feedback-${Date.now()}`,
      timestamp: Date.now(),
    }

    setTraces((prev) =>
      prev.map((trace) =>
        trace.id === traceId
          ? {
              ...trace,
              steps: trace.steps.map((step) => {
                if (step.id === stepId) {
                  const existingFeedbacks = step.feedbacks || []
                  const updatedFeedbacks = [...existingFeedbacks, newFeedback]
                  return { 
                    ...step, 
                    feedback: newFeedback, // Keep most recent feedback for backward compatibility
                    feedbacks: updatedFeedbacks // Store all feedback entries
                  }
                }
                return step
              }),
            }
          : trace,
      ),
    )

    const processingToast = toast({
      title: "Processing feedback",
      description: "Transforming feedback into evaluation question...",
      duration: Number.POSITIVE_INFINITY,
    })

    try {
      let targetRubric: Rubric | undefined

      if (feedback.stepType === "RESPONSE") {
        const existingRubrics = getRubricsByStepType("RESPONSE")
        targetRubric = existingRubrics[existingRubrics.length - 1]

        if (!targetRubric) {
          targetRubric = addRubric({
            stepType: "RESPONSE",
            category: "final-output",
            rubricType: "response",
            version: 1,
            questions: [],
            feedbackCount: 0,
            isGenerating: true,
          })
        } else {
          updateRubric(targetRubric.id, { isGenerating: true })
        }
      } else if (feedback.stepType === "THINKING") {
        const existingRubrics = getRubricsByStepType("THINKING")
        targetRubric = existingRubrics[existingRubrics.length - 1]

        if (!targetRubric) {
          targetRubric = addRubric({
            stepType: "THINKING",
            category: "action-steps",
            rubricType: "thinking",
            version: 1,
            questions: [],
            feedbackCount: 0,
            isGenerating: true,
          })
        } else {
          updateRubric(targetRubric.id, { isGenerating: true })
        }
      } else if (feedback.stepType === "ACTION" || feedback.stepType === "OBSERVATION") {
        const rubricType = feedback.stepType === "ACTION" ? "tool-call" : "tool-result"
        const existingRubrics = getRubricsByToolNameAndType(feedback.toolName!, rubricType)
        targetRubric = existingRubrics[existingRubrics.length - 1]

        if (!targetRubric) {
          targetRubric = addRubric({
            stepType: feedback.stepType,
            category: "action-steps",
            rubricType,
            toolName: feedback.toolName,
            version: 1,
            questions: [],
            feedbackCount: 0,
            isGenerating: true,
          })
        } else {
          updateRubric(targetRubric.id, { isGenerating: true })
        }
      }

      const question = await transformFeedbackToQuestion(newFeedback)

      if (targetRubric) {
        const updatedQuestions = [...targetRubric.questions, question]
        const updatedRubric: Rubric = {
          ...targetRubric,
          questions: updatedQuestions,
          feedbackCount: targetRubric.feedbackCount + 1,
          isGenerating: false,
        }

        updateRubric(targetRubric.id, {
          questions: updatedQuestions,
          feedbackCount: targetRubric.feedbackCount + 1,
          isGenerating: false,
        })

        console.log("[v0] Rubric updated, triggering re-scoring for rubric:", updatedRubric.id)
        setTimeout(() => {
          rescoreStepsForRubric(updatedRubric)
        }, 100)
      }

      processingToast.dismiss()
      toast({
        title: "Question added",
        description: "Feedback successfully transformed into evaluation question.",
        duration: 3000,
      })
    } catch (error) {
      console.error("[v0] Failed to auto-generate question from feedback:", error)
      processingToast.dismiss()
      toast({
        title: "Failed to process feedback",
        description: "Could not transform feedback into question. Please try again.",
        variant: "destructive",
        duration: 5000,
      })
      const rubrics = getRubricsByStepType(feedback.stepType)
      const lastRubric = rubrics[rubrics.length - 1]
      if (lastRubric) {
        updateRubric(lastRubric.id, { isGenerating: false })
      }
    }
  }

  const getFeedbackByStepType = (stepType: StepType): StepFeedback[] => {
    const allFeedback: StepFeedback[] = []
    traces.forEach((trace) => {
      trace.steps.forEach((step) => {
        if (step.type === stepType) {
          // Collect from both the new feedbacks array and legacy feedback field
          if (step.feedbacks && step.feedbacks.length > 0) {
            allFeedback.push(...step.feedbacks)
          } else if (step.feedback) {
            allFeedback.push(step.feedback)
          }
        }
      })
    })
    return allFeedback
  }

  const getFeedbackByToolName = (toolName: string): StepFeedback[] => {
    const allFeedback: StepFeedback[] = []
    traces.forEach((trace) => {
      trace.steps.forEach((step) => {
        if ((step.type === "ACTION" || step.type === "OBSERVATION") && step.toolName === toolName) {
          // Collect from both the new feedbacks array and legacy feedback field
          if (step.feedbacks && step.feedbacks.length > 0) {
            allFeedback.push(...step.feedbacks.map(f => ({ ...f, toolName: step.toolName })))
          } else if (step.feedback) {
            allFeedback.push({ ...step.feedback, toolName: step.toolName })
          }
        }
      })
    })
    return allFeedback
  }

  const getFeedbackByToolNameAndType = (toolName: string, rubricType: "tool-call" | "tool-result"): StepFeedback[] => {
    const allFeedback: StepFeedback[] = []
    const targetStepType = rubricType === "tool-call" ? "ACTION" : "OBSERVATION"

    traces.forEach((trace) => {
      trace.steps.forEach((step) => {
        if (step.type === targetStepType && step.toolName === toolName) {
          // Collect from both the new feedbacks array and legacy feedback field
          if (step.feedbacks && step.feedbacks.length > 0) {
            allFeedback.push(...step.feedbacks.map(f => ({ ...f, toolName: step.toolName })))
          } else if (step.feedback) {
            allFeedback.push({ ...step.feedback, toolName: step.toolName })
          }
        }
      })
    })
    return allFeedback
  }

  const getUniqueToolNames = (): string[] => {
    const toolNames = new Set<string>()
    traces.forEach((trace) => {
      trace.steps.forEach((step) => {
        if (step.type === "ACTION" && step.toolName) {
          toolNames.add(step.toolName)
        }
      })
    })
    return Array.from(toolNames).sort()
  }

  const addRubric = (rubric: Omit<Rubric, "id" | "createdAt">) => {
    const newRubric: Rubric = {
      ...rubric,
      id: `rubric-${Date.now()}`,
      createdAt: Date.now(),
    }
    setRubrics((prev) => [...prev, newRubric])
    return newRubric
  }

  const updateRubric = (id: string, updates: Partial<Rubric>) => {
    setRubrics((prev) => prev.map((rubric) => (rubric.id === id ? { ...rubric, ...updates } : rubric)))
  }

  const deleteRubric = (id: string) => {
    setRubrics((prev) => prev.filter((rubric) => rubric.id !== id))
  }

  const getRubricsByStepType = (stepType: StepType): Rubric[] => {
    return rubrics.filter((rubric) => rubric.stepType === stepType)
  }

  const getRubricsByToolNameAndType = (toolName: string, rubricType: "tool-call" | "tool-result"): Rubric[] => {
    return rubrics
      .filter((rubric) => rubric.toolName === toolName && rubric.rubricType === rubricType)
      .sort((a, b) => a.version - b.version)
  }

  const scoreStep = async (step: AgentStep, trace: AgentTrace, rubric?: Rubric): Promise<StepScore | null> => {
    console.log("[v0] scoreStep: Starting to score step", step.id, "type:", step.type)

    try {
      let targetRubric = rubric

      if (!targetRubric) {
        if (step.type === "RESPONSE") {
          const rubrics = getRubricsByStepType("RESPONSE")
          targetRubric = rubrics[rubrics.length - 1]
        } else if (step.type === "THINKING") {
          const rubrics = getRubricsByStepType("THINKING")
          targetRubric = rubrics[rubrics.length - 1]
        } else if (step.type === "ACTION" && step.toolName) {
          const rubrics = getRubricsByToolNameAndType(step.toolName, "tool-call")
          targetRubric = rubrics[rubrics.length - 1]
        } else if (step.type === "OBSERVATION" && step.toolName) {
          const rubrics = getRubricsByToolNameAndType(step.toolName, "tool-result")
          targetRubric = rubrics[rubrics.length - 1]
        }
      }

      if (!targetRubric || targetRubric.questions.length === 0) {
        console.log("[v0] scoreStep: No rubric found or rubric has no questions")
        return null
      }

      console.log("[v0] scoreStep: Found rubric", targetRubric.id, "with", targetRubric.questions.length, "questions")

      // This ensures we only use the context that was available when the step was originally scored
      const precedingSteps = trace.steps.filter((s) => s.timestamp <= step.timestamp && s.id !== step.id)

      console.log("[v0] scoreStep: Step context:", {
        stepId: step.id,
        stepType: step.type,
        stepTimestamp: step.timestamp,
        precedingStepsCount: precedingSteps.length,
        totalStepsInTrace: trace.steps.length,
        traceInput: trace.input,
      })

      let scoringData
      if (step.type === "RESPONSE") {
        scoringData = prepareResponseScoringData(trace.input, step.content)
      } else if (step.type === "THINKING") {
        scoringData = await prepareThinkingFromSteps(precedingSteps, step.content, trace.input)
      } else if (step.type === "ACTION") {
        scoringData = await prepareActionFromSteps(precedingSteps, step.toolName!, step.toolInput, trace.input)
      } else if (step.type === "OBSERVATION") {
        const actionStep = trace.steps.find((s) => s.toolCallId === step.toolCallId && s.type === "ACTION")
        console.log("[v0] scoreStep: OBSERVATION action step lookup:", {
          toolCallId: step.toolCallId,
          foundActionStep: !!actionStep,
          actionStepId: actionStep?.id,
        })
        scoringData = prepareObservationFromSteps(step.toolName!, actionStep?.toolInput, step.toolOutput)
      } else {
        return null
      }
      console.log("[v0] scoreStep: Calling getScoredData")
      const scoredData = await getScoredData([scoringData], targetRubric.questions)

      if (scoredData.length > 0) {
        const scoreResult = scoredData[0]
        const questionScoresWithText = scoreResult.questionScores.map((qs) => {
          const question = targetRubric ? targetRubric.questions.find((q) => q.label === qs.label) : null;
          return {
            label: qs.label,
            question: question?.question || "",
            score: qs.score,
          }
        })

        const newScore: StepScore = {
          rubricId: targetRubric.id,
          total: scoreResult.score,
          questionScores: questionScoresWithText,
          timestamp: Date.now(),
          isLoading: false,
        }

        console.log("[v0] scoreStep: Score calculated:", newScore.total)
        return newScore
      }

      return null
    } catch (error) {
      console.error("[v0] Failed to score step:", error)
      return null
    }
  }

  const rescoreStepsForRubric = async (rubric: Rubric) => {
    const stepsToRescore: Array<{ trace: AgentTrace; step: AgentStep }> = []
    traces.forEach((trace) => {
      trace.steps.forEach((step) => {
        let shouldRescore = false

        if (rubric.stepType === "RESPONSE" && step.type === "RESPONSE") {
          shouldRescore = true
        } else if (rubric.stepType === "THINKING" && step.type === "THINKING") {
          shouldRescore = true
        } else if (rubric.stepType === "ACTION" && step.type === "ACTION" && step.toolName === rubric.toolName) {
          shouldRescore = true
        } else if (
          rubric.stepType === "OBSERVATION" &&
          step.type === "OBSERVATION" &&
          step.toolName === rubric.toolName
        ) {
          shouldRescore = true
        }

        if (shouldRescore) {
          stepsToRescore.push({ trace, step })
        }
      })
    })

    for (const { trace, step } of stepsToRescore) {
      const score = await scoreStep(step, trace, rubric)

      setTraces((prev) =>
        prev.map((t) =>
          t.id === trace.id
            ? {
              ...t,
              steps: t.steps.map((s) => (s.id === step.id ? { ...s, score } : s)),
            }
            : t,
        ),
      )

      setCurrentTrace((prev) => {
        if (prev?.id === trace.id) {
          return {
            ...prev,
            steps: prev.steps.map((s) => (s.id === step.id ? { ...s, score } : s)),
          }
        }
        return prev
      })
    }

    toast({
      title: "Re-scoring complete",
      description: `Re-scored ${stepsToRescore.length} step(s) with updated rubric.`,
      duration: 3000,
    })
  }

  return (
    <AgentContext.Provider
      value={{
        configs,
        traces,
        rubrics,
        currentConfig,
        currentTrace,
        updateConfig,
        setCurrentConfig,
        findOrCreateConfig,
        addTrace,
        updateTrace,
        setCurrentTrace,
        addStepToTrace,
        updateStepScore, // Export the new function
        addFeedback,
        getFeedbackByStepType,
        getFeedbackByToolName,
        getFeedbackByToolNameAndType,
        getUniqueToolNames,
        addRubric,
        updateRubric,
        deleteRubric,
        getRubricsByStepType,
        getRubricsByToolNameAndType,
        scoreStep,
        rescoreStepsForRubric,
      }}
    >
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  const context = useContext(AgentContext)
  if (!context) {
    throw new Error("useAgent must be used within AgentProvider")
  }
  return context
}
