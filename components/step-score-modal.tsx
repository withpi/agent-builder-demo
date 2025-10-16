"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAgent } from "@/lib/agent-context"
import type { StepScore } from "@/lib/agent-context"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface StepScoreModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  score: StepScore
  stepType: string
  toolName?: string
  stepId: string
  traceId: string
}

export function StepScoreModal({
  open,
  onOpenChange,
  score,
  stepType,
  toolName,
  stepId,
  traceId,
}: StepScoreModalProps) {
  const totalPercentage = Math.round(score.total * 100)
  const { updateRubric, rescoreStepsForRubric, getRubricsByStepType, getRubricsByToolNameAndType, traces } = useAgent()
  const [editingQuestion, setEditingQuestion] = useState<{ label: string; question: string; index: number } | null>(
    null,
  )
  const [editLabel, setEditLabel] = useState("")
  const [editQuestionText, setEditQuestionText] = useState("")

  const handleQuestionClick = (questionLabel: string, questionText: string, index: number) => {
    setEditingQuestion({ label: questionLabel, question: questionText, index })
    setEditLabel(questionLabel)
    setEditQuestionText(questionText)
  }

  const handleEditQuestion = async () => {
    if (!editingQuestion) return

    // Find the trace and step to determine rubric type
    const trace = traces.find((t) => t.id === traceId)
    const step = trace?.steps.find((s) => s.id === stepId)

    if (!step) return

    // Find the rubric that was used to score this step
    let rubric
    if (stepType === "RESPONSE") {
      const rubrics = getRubricsByStepType("RESPONSE")
      rubric = rubrics.find((r) => r.id === score.rubricId)
    } else if (stepType === "THINKING") {
      const rubrics = getRubricsByStepType("THINKING")
      rubric = rubrics.find((r) => r.id === score.rubricId)
    } else if (stepType === "Tool Call" && toolName) {
      const rubrics = getRubricsByToolNameAndType(toolName, "tool-call")
      rubric = rubrics.find((r) => r.id === score.rubricId)
    } else if (stepType === "Tool Result" && toolName) {
      const rubrics = getRubricsByToolNameAndType(toolName, "tool-result")
      rubric = rubrics.find((r) => r.id === score.rubricId)
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
    // Find the trace and step to determine rubric type
    const trace = traces.find((t) => t.id === traceId)
    const step = trace?.steps.find((s) => s.id === stepId)

    if (!step) return

    // Find the rubric that was used to score this step
    let rubric
    if (stepType === "RESPONSE") {
      const rubrics = getRubricsByStepType("RESPONSE")
      rubric = rubrics.find((r) => r.id === score.rubricId)
    } else if (stepType === "THINKING") {
      const rubrics = getRubricsByStepType("THINKING")
      rubric = rubrics.find((r) => r.id === score.rubricId)
    } else if (stepType === "Tool Call" && toolName) {
      const rubrics = getRubricsByToolNameAndType(toolName, "tool-call")
      rubric = rubrics.find((r) => r.id === score.rubricId)
    } else if (stepType === "Tool Result" && toolName) {
      const rubrics = getRubricsByToolNameAndType(toolName, "tool-result")
      rubric = rubrics.find((r) => r.id === score.rubricId)
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-screen overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span>Step Score Details</span>
              <Badge variant="outline" className="text-base">
                {totalPercentage}%
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">Step Information</div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Type: {stepType}</div>
                {toolName && <div>Tool: {toolName}</div>}
                <div>Scored: {new Date(score.timestamp).toLocaleString()}</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Total Score</h3>
                <span className="text-2xl font-bold">{totalPercentage}%</span>
              </div>
              <Progress value={totalPercentage} className="h-3" />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Question Scores</h3>
              <div className="space-y-3">
                {score.questionScores.map((qs, idx) => {
                  const percentage = Math.round(qs.score * 100)
                  return (
                    <div
                      key={idx}
                      className="p-3 border rounded-lg bg-background cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleQuestionClick(qs.label, qs.question, idx)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{qs.label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{qs.question}</div>
                        </div>
                        <Badge variant={percentage >= 70 ? "default" : percentage >= 40 ? "secondary" : "destructive"}>
                          {percentage}%
                        </Badge>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {editingQuestion !== null && (
        <Dialog open={editingQuestion !== null} onOpenChange={() => setEditingQuestion(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Question</DialogTitle>
              <DialogDescription>
                Modify the question label and text. This will create a new rubric version and rescore all affected
                steps.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-label-modal" className="text-sm font-medium">
                  Question Label
                </label>
                <input
                  id="edit-label-modal"
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="e.g., Timeliness of Search Action"
                  className="w-full mt-1.5 px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label htmlFor="edit-question-modal" className="text-sm font-medium">
                  Question Text
                </label>
                <Textarea
                  id="edit-question-modal"
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
      )}
    </>
  )
}
