"use client"

import { useState, memo } from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ThumbsUp, ThumbsDown, Award, FileText } from "lucide-react"
import type { AgentStep, StepType } from "@/lib/agent-context"
import { useAgent } from "@/lib/agent-context"
import {
  prepareResponseFromSteps,
  prepareActionFromSteps,
  prepareObservationFromSteps,
  prepareThinkingFromSteps, prepareResponseScoringData,
} from "@/lib/utils/scoring-utils"
import { MemoizedMarkdown } from "./memoized-markdown"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { StepScoreModal } from "./step-score-modal"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface StepCardProps {
  step: AgentStep
  traceId: string
  isStreaming?: boolean
}

const stepColors: Record<StepType, { bg: string; border: string; text: string }> = {
  THINKING: { bg: "bg-green-50", border: "border-l-green-500", text: "text-green-700" },
  ACTION: { bg: "bg-blue-50", border: "border-l-blue-500", text: "text-blue-700" },
  OBSERVATION: { bg: "bg-orange-50", border: "border-l-orange-500", text: "text-orange-700" },
  RESPONSE: { bg: "bg-purple-50", border: "border-l-purple-500", text: "text-purple-700" },
  FEEDBACK: { bg: "bg-transparent", border: "", text: "text-red-700" },
}

const stepDisplayNames: Record<StepType, string> = {
  THINKING: "THINKING",
  ACTION: "Tool Call",
  OBSERVATION: "Tool Result",
  RESPONSE: "RESPONSE",
  FEEDBACK: "FEEDBACK",
}

export const StepCard = memo(function StepCard({ step, traceId, isStreaming = false }: StepCardProps) {
  const {
    addFeedback,
    currentTrace,
    getRubricsByStepType,
    getRubricsByToolNameAndType,
    updateRubric,
    rescoreStepsForRubric,
  } = useAgent()
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [feedbackRating, setFeedbackRating] = useState<"up" | "down">("up")
  const [feedbackDescription, setFeedbackDescription] = useState("")
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [prettyPrint, setPrettyPrint] = useState(true)
  const [editingQuestion, setEditingQuestion] = useState<{ label: string; question: string; index: number } | null>(
    null,
  )
  const [editLabel, setEditLabel] = useState("")
  const [editQuestionText, setEditQuestionText] = useState("")

  const colors = stepColors[step.type]

  const allowFeedback = true

  const handleFeedbackSubmit = async () => {
    if (!currentTrace) return

    setIsSubmittingFeedback(true)

    try {
      // Determine input and output based on step type
      let scoringData: { input: string; output: string }

      const stepIndex = currentTrace.steps.findIndex((s) => s.id === step.id)
      const precedingSteps = currentTrace.steps.slice(0, stepIndex)

      if (step.type === "RESPONSE") {
        scoringData = prepareResponseScoringData(currentTrace.input, step.content)
      } else if (step.type === "THINKING") {
        scoringData = await prepareThinkingFromSteps(precedingSteps, step.content, currentTrace.input)
      } else if (step.type === "ACTION") {
        scoringData = await prepareActionFromSteps(precedingSteps, step.toolName!, step.toolInput, currentTrace.input)
      } else if (step.type === "OBSERVATION") {
        const actionStep = precedingSteps.find((s) => s.toolCallId === step.toolCallId && s.type === "ACTION")
        scoringData = prepareObservationFromSteps(step.toolName!, actionStep?.toolInput, step.toolOutput)
      } else if (step.type === "FEEDBACK") {
        // For feedback step: manually construct since it's not a standard scoring type
        scoringData = {
          input: JSON.stringify(precedingSteps),
          output: step.feedback?.description || "",
        }
      } else {
        // Fallback for unknown types
        scoringData = { input: "", output: "" }
      }

      const feedbackData: any = {
        stepId: step.id,
        stepType: step.type,
        toolName: step.toolName,
        rating: feedbackRating,
        description: feedbackDescription,
        input: scoringData.input,
        output: scoringData.output,
      }

      // If this is an observation, link it to the action that triggered it
      if (step.type === "OBSERVATION" && step.toolCallId) {
        feedbackData.actionStepId = step.toolCallId
      }

      addFeedback(traceId, step.id, feedbackData)
      setShowFeedbackDialog(false)
      setFeedbackDescription("")
    } catch (error) {
      console.error("Error submitting feedback:", error)
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  const handleThumbsClick = (rating: "up" | "down") => {
    setFeedbackRating(rating)
    setShowFeedbackDialog(true)
  }

  const handleQuestionClick = (questionLabel: string, questionText: string, index: number) => {
    setEditingQuestion({ label: questionLabel, question: questionText, index })
    setEditLabel(questionLabel)
    setEditQuestionText(questionText)
  }

  const handleEditQuestion = async () => {
    if (!step.score || !editingQuestion) return

    // Find the rubric that was used to score this step
    let rubric
    if (step.type === "RESPONSE") {
      const rubrics = getRubricsByStepType("RESPONSE")
      rubric = rubrics.find((r) => r.id === step.score!.rubricId)
    } else if (step.type === "THINKING") {
      const rubrics = getRubricsByStepType("THINKING")
      rubric = rubrics.find((r) => r.id === step.score!.rubricId)
    } else if (step.type === "ACTION" && step.toolName) {
      const rubrics = getRubricsByToolNameAndType(step.toolName, "tool-call")
      rubric = rubrics.find((r) => r.id === step.score!.rubricId)
    } else if (step.type === "OBSERVATION" && step.toolName) {
      const rubrics = getRubricsByToolNameAndType(step.toolName, "tool-result")
      rubric = rubrics.find((r) => r.id === step.score!.rubricId)
    }

    if (!rubric) {
      console.error("[v0] Could not find rubric to edit question")
      return
    }

    // Update the question in the rubric
    const updatedQuestions = rubric.questions.map((q, i) =>
      i === editingQuestion.index ? { label: editLabel, question: editQuestionText } : q,
    )

    // Update the rubric with the new questions list
    updateRubric(rubric.id, {
      questions: updatedQuestions,
      version: rubric.version + 1,
    })

    // Trigger rescoring for all steps using this rubric
    await rescoreStepsForRubric({ ...rubric, questions: updatedQuestions, version: rubric.version + 1 })

    setEditingQuestion(null)
  }

  const handleDeleteQuestion = async (questionLabel: string) => {
    if (!step.score) return

    // Find the rubric that was used to score this step
    let rubric
    if (step.type === "RESPONSE") {
      const rubrics = getRubricsByStepType("RESPONSE")
      rubric = rubrics.find((r) => r.id === step.score!.rubricId)
    } else if (step.type === "THINKING") {
      const rubrics = getRubricsByStepType("THINKING")
      rubric = rubrics.find((r) => r.id === step.score!.rubricId)
    } else if (step.type === "ACTION" && step.toolName) {
      const rubrics = getRubricsByToolNameAndType(step.toolName, "tool-call")
      rubric = rubrics.find((r) => r.id === step.score!.rubricId)
    } else if (step.type === "OBSERVATION" && step.toolName) {
      const rubrics = getRubricsByToolNameAndType(step.toolName, "tool-result")
      rubric = rubrics.find((r) => r.id === step.score!.rubricId)
    }

    if (!rubric) {
      console.error("[v0] Could not find rubric to delete question from")
      return
    }

    // Remove the question from the rubric
    const updatedQuestions = rubric.questions.filter((q) => q.label !== questionLabel)

    // Update the rubric with the new questions list
    updateRubric(rubric.id, {
      questions: updatedQuestions,
      version: rubric.version + 1,
    })

    // Trigger rescoring for all steps using this rubric
    await rescoreStepsForRubric({ ...rubric, questions: updatedQuestions, version: rubric.version + 1 })

    setEditingQuestion(null)
  }

  const scorePercentage = step.score ? Math.round(step.score.total * 100) : null

  return (
    <>
      <Card
        className={`${colors.bg} ${colors.border} w-full ${step.type === "FEEDBACK" ? "ml-[30px] shadow-none border-2 border-red-500" : "border-l-4"}`}
      >
        <TooltipProvider>
          <div className="px-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <div className={`text-sm font-semibold ${colors.text} mb-1 flex items-center gap-2`}>
                  {step.type === "FEEDBACK" && (
                    <Image src="/pi-logo.svg" alt="Pi Logo" width={20} height={20} className="flex-shrink-0" />
                  )}
                  {step.type === "FEEDBACK" ? "Pi Judge Feedback to Agent" : stepDisplayNames[step.type]}
                  {isStreaming && <Spinner className="w-3 h-3" />}
                </div>
                {step.toolName && (
                  <div className="text-xs text-muted-foreground mb-2">
                    Executing: {step.toolName}
                    {step.toolInput && `(${JSON.stringify(step.toolInput)})`}
                  </div>
                )}
              </div>
              {!isStreaming && step.type !== "FEEDBACK" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{new Date(step.timestamp).toLocaleTimeString()}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setPrettyPrint(!prettyPrint)}
                      >
                        <FileText className={`w-4 h-4 ${prettyPrint ? "text-blue-600" : ""}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{prettyPrint ? "Disable pretty print" : "Enable pretty print"}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleThumbsClick("up")}>
                        <ThumbsUp
                          className={`w-4 h-4 ${step.feedbacks?.some(f => f.rating === "up") ? "fill-current text-green-600" : ""}`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Positive feedback</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleThumbsClick("down")}>
                        <ThumbsDown
                          className={`w-4 h-4 ${step.feedbacks?.some(f => f.rating === "down") ? "fill-current text-red-600" : ""}`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Negative feedback</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>

            {prettyPrint && !isStreaming ? (
              <MemoizedMarkdown 
                content={step.content}
                className="text-sm prose prose-sm max-w-none dark:prose-invert prose-table:text-sm prose-th:p-2 prose-td:p-2"
              />
            ) : (
              <div className="text-sm whitespace-pre-wrap">
                {step.content}
                {isStreaming && <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />}
              </div>
            )}

            {step.type === "OBSERVATION" && step.toolName && (
              <div className="mt-3 p-3 bg-background/50 rounded text-xs font-mono overflow-x-auto">
                <div className="text-muted-foreground mb-1">Tool Call:</div>
                <div className="whitespace-pre-wrap">
                  {step.toolName}(
                  {step.toolInput && Object.keys(step.toolInput).length > 0
                    ? "\n  " + JSON.stringify(step.toolInput, null, 2).split("\n").join("\n  ").slice(0, -2) + "\n"
                    : ""}
                  )
                </div>
              </div>
            )}
            {step.type !== "OBSERVATION" && step.toolOutput && (
              <div className="mt-3 p-3 bg-background/50 rounded text-xs">
                {prettyPrint && typeof step.toolOutput === "string" ? (
                  <MemoizedMarkdown 
                    content={step.toolOutput}
                    className="prose prose-xs max-w-none dark:prose-invert prose-table:text-xs prose-th:p-1 prose-td:p-1"
                  />
                ) : (
                  <div className="font-mono">
                    {typeof step.toolOutput === "string" ? step.toolOutput : JSON.stringify(step.toolOutput, null, 2)}
                  </div>
                )}
              </div>
            )}

            {step.score && (
              <div className="mt-3 pt-3 border-t">
                {step.score.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner className="w-4 h-4" />
                    <span>Scoring step...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Score: {scorePercentage}%</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setShowScoreModal(true)}>
                        View Details
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {step.score.questionScores.slice(0, 3).map((qs, idx) => {
                        const qPercentage = Math.round(qs.score * 100)
                        return (
                          <Badge
                            key={idx}
                            variant={qPercentage >= 70 ? "default" : qPercentage >= 40 ? "secondary" : "destructive"}
                            className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => handleQuestionClick(qs.label, qs.question, idx)}
                          >
                            {qs.label}: {qPercentage}%
                          </Badge>
                        )
                      })}
                      {step.score.questionScores.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{step.score.questionScores.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(step.feedbacks && step.feedbacks.length > 0) && (
              <div className="mt-3 pt-3 border-t">
                <div className="space-y-2">
                  {step.feedbacks.map((feedback, index) => (
                    <div key={feedback.id} className="flex items-start gap-2">
                      <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                        feedback.rating === 'up' ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {feedback.rating === 'up' ? '👍' : '👎'} Feedback {index + 1}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(feedback.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">{feedback.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TooltipProvider>
      </Card>

      {step.score && !step.score.isLoading && (
        <StepScoreModal
          open={showScoreModal}
          onOpenChange={setShowScoreModal}
          score={step.score}
          stepType={stepDisplayNames[step.type]}
          toolName={step.toolName}
          stepId={step.id}
          traceId={traceId}
        />
      )}

      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Provide Feedback</DialogTitle>
            <DialogDescription>
              Help improve the agent by describing what went {feedbackRating === "up" ? "well" : "wrong"} with this
              step.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={feedbackDescription}
            onChange={(e) => setFeedbackDescription(e.target.value)}
            placeholder={`Describe what ${feedbackRating === "up" ? "worked well" : "went wrong"}...`}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleFeedbackSubmit} disabled={!feedbackDescription.trim() || isSubmittingFeedback}>
              {isSubmittingFeedback ? <Spinner className="w-4 h-4 mr-2" /> : null}
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingQuestion !== null} onOpenChange={() => setEditingQuestion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Modify the question label and text. This will create a new rubric version and rescore all affected steps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label htmlFor="edit-label" className="text-sm font-medium">
                Question Label
              </label>
              <input
                id="edit-label"
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="e.g., Timeliness of Search Action"
                className="w-full mt-1.5 px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label htmlFor="edit-question" className="text-sm font-medium">
                Question Text
              </label>
              <Textarea
                id="edit-question"
                value={editQuestionText}
                onChange={(e) => setEditQuestionText(e.target.value)}
                placeholder="e.g., Does the agent initiate the search early enough?"
                rows={4}
                className="mt-1.5"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingQuestion(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => editingQuestion && handleDeleteQuestion(editingQuestion.label)}
              >
                Delete Question
              </Button>
              <Button onClick={handleEditQuestion} disabled={!editLabel.trim() || !editQuestionText.trim()}>
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})
