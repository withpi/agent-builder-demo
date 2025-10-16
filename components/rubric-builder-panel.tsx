"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { History, MessageSquare, Eye, Loader2, Sparkles, Pencil, Trash2, Plus, Brain } from "lucide-react"
import { useAgent } from "@/lib/agent-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RubricGenerator } from "@/components/rubric/scorer_generator"
import type { RubricExample } from "@/lib/rubric/rubricActions"
import PiClient from "withpi"
import Question = PiClient.Question
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export function RubricBuilderPanel() {
  const {
    getFeedbackByStepType,
    getFeedbackByToolNameAndType,
    getUniqueToolNames,
    addRubric,
    getRubricsByToolNameAndType,
    getRubricsByStepType,
    currentConfig,
    rescoreStepsForRubric,
  } = useAgent()
  const [selectedRubricKey, setSelectedRubricKey] = useState<string | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showFeedbackReview, setShowFeedbackReview] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<{ index: number; question: Question } | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [editQuestionText, setEditQuestionText] = useState("")
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [newCriteriaName, setNewCriteriaName] = useState("")
  const [newCriteriaDescription, setNewCriteriaDescription] = useState("")

  const handleApplyRubric = async (rubricKey: string, questions: Question[]) => {
    const isToolRubric = rubricKey !== "final-output" && rubricKey !== "thinking"
    const isThinkingRubric = rubricKey === "thinking"

    let newRubric

    if (isThinkingRubric) {
      const feedback = getFeedbackByStepType("THINKING")
      const existingRubrics = getRubricsByStepType("THINKING")
      const version = existingRubrics.length + 1

      newRubric = addRubric({
        stepType: "THINKING",
        category: "action-steps",
        rubricType: "thinking",
        version,
        questions,
        feedbackCount: feedback.length,
      })
    } else if (isToolRubric) {
      const [toolName, rubricType] = rubricKey.split(":") as [string, "tool-call" | "tool-result"]
      const feedback = getFeedbackByToolNameAndType(toolName, rubricType)
      const existingRubrics = getRubricsByToolNameAndType(toolName, rubricType)
      const version = existingRubrics.length + 1

      newRubric = addRubric({
        stepType: rubricType === "tool-call" ? "ACTION" : "OBSERVATION",
        category: "action-steps",
        rubricType,
        toolName,
        version,
        questions,
        feedbackCount: feedback.length,
      })
    } else {
      const feedback = getFeedbackByStepType("RESPONSE")
      const existingRubrics = getRubricsByStepType("RESPONSE")
      const version = existingRubrics.length + 1

      newRubric = addRubric({
        stepType: "RESPONSE",
        category: "final-output",
        rubricType: "response",
        version,
        questions,
        feedbackCount: feedback.length,
      })
    }

    if (newRubric) {
      await rescoreStepsForRubric(newRubric)
    }
  }

  const handleRemoveQuestion = async (rubricKey: string, questionIndex: number) => {
    const rubrics = getRubricsForKey(rubricKey)
    const latestRubric = rubrics[rubrics.length - 1]
    if (!latestRubric) return

    const updatedQuestions = latestRubric.questions.filter((_, i) => i !== questionIndex)
    await handleApplyRubric(rubricKey, updatedQuestions)
  }

  const handleEditQuestion = async (rubricKey: string, questionIndex: number, updatedQuestion: Question) => {
    const rubrics = getRubricsForKey(rubricKey)
    const latestRubric = rubrics[rubrics.length - 1]
    if (!latestRubric) return

    const updatedQuestions = latestRubric.questions.map((q, i) => (i === questionIndex ? updatedQuestion : q))
    await handleApplyRubric(rubricKey, updatedQuestions)
    setEditingQuestion(null)
  }

  const openEditDialog = (rubricKey: string, questionIndex: number, question: Question) => {
    setSelectedRubricKey(rubricKey)
    setEditingQuestion({ index: questionIndex, question })
    setEditLabel(question.label || '')
    setEditQuestionText(question.question)
  }

  const openAddQuestionDialog = (rubricKey: string) => {
    setSelectedRubricKey(rubricKey)
    setNewCriteriaName("")
    setNewCriteriaDescription("")
    setShowAddQuestion(true)
  }

  const handleAddQuestion = async () => {
    if (!selectedRubricKey || !newCriteriaName.trim() || !newCriteriaDescription.trim()) return

    const rubrics = getRubricsForKey(selectedRubricKey)
    const latestRubric = rubrics[rubrics.length - 1]

    const newQuestion: Question = {
      label: newCriteriaName,
      question: newCriteriaDescription,
    }

    const updatedQuestions = latestRubric ? [...latestRubric.questions, newQuestion] : [newQuestion]
    await handleApplyRubric(selectedRubricKey, updatedQuestions)
    setShowAddQuestion(false)
    setNewCriteriaName("")
    setNewCriteriaDescription("")
  }

  const getRubricsForKey = (key: string) => {
    if (key === "final-output") {
      return getRubricsByStepType("RESPONSE")
    }
    if (key === "thinking") {
      return getRubricsByStepType("THINKING")
    }
    const [toolName, rubricType] = key.split(":") as [string, "tool-call" | "tool-result"]
    return getRubricsByToolNameAndType(toolName, rubricType)
  }

  const getFeedbackForKey = (key: string) => {
    if (key === "final-output") {
      return getFeedbackByStepType("RESPONSE")
    }
    if (key === "thinking") {
      return getFeedbackByStepType("THINKING")
    }
    const [toolName, rubricType] = key.split(":") as [string, "tool-call" | "tool-result"]
    return getFeedbackByToolNameAndType(toolName, rubricType)
  }

  const finalOutputFeedback = getFeedbackByStepType("RESPONSE")
  const finalOutputRubrics = getRubricsByStepType("RESPONSE")
  const latestFinalOutputRubric = finalOutputRubrics[finalOutputRubrics.length - 1]

  const thinkingFeedback = getFeedbackByStepType("THINKING")
  const thinkingRubrics = getRubricsByStepType("THINKING")
  const latestThinkingRubric = thinkingRubrics[thinkingRubrics.length - 1]

  const toolNames = getUniqueToolNames()

  const convertFeedbackToExamples = (feedback: any[]): { goodExamples: RubricExample[]; badExamples: RubricExample[] } => {
    const goodExamples: RubricExample[] = []
    const badExamples: RubricExample[] = []

    feedback.forEach((f) => {
      const example: RubricExample = {
        llm_input: f.input,
        llm_output: f.output,
      }

      if (f.rating === "up") {
        goodExamples.push(example)
      } else {
        badExamples.push(example)
      }
    })

    return { goodExamples, badExamples }
  }

  const QuestionCard = ({
    question,
    index,
    rubricKey,
    borderColor,
  }: {
    question: Question
    index: number
    rubricKey: string
    borderColor: string
  }) => (
    <div className={`text-xs p-3 bg-white border ${borderColor} rounded-md shadow-sm group relative`}>
      <div className="font-semibold text-foreground">{question.label}</div>
      <div className="text-muted-foreground mt-1">{question.question}</div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => openEditDialog(rubricKey, index, question)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={() => handleRemoveQuestion(rubricKey, index)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Rubric Builder</h2>
          <p className="text-muted-foreground">Build evaluation rubrics organized by Final Output and Action Steps</p>
        </div>

        <div className="space-y-8">
          {/* Final Output Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5" />
              <h3 className="text-xl font-semibold">Final Output</h3>
            </div>

            <Card className="p-6 bg-purple-50 border-l-4 border-l-purple-500">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div>
                    <h4 className="text-lg font-semibold mb-1 text-purple-700">Response Evaluation</h4>
                    <p className="text-sm text-muted-foreground">
                      {finalOutputFeedback.length === 0
                        ? "no judges defined"
                        : `${finalOutputFeedback.length} feedback items collected`}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-purple-700 hover:text-purple-900 hover:bg-purple-100"
                    onClick={() => openAddQuestionDialog("final-output")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {finalOutputRubrics.length > 0 && <Badge variant="secondary">v{latestFinalOutputRubric.version}</Badge>}
              </div>

              <div className="space-y-3">
                {latestFinalOutputRubric && latestFinalOutputRubric.questions.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Current Questions:</div>
                    <div className="space-y-2">
                      {latestFinalOutputRubric.questions.map((q, i) => (
                        <QuestionCard
                          key={i}
                          question={q}
                          index={i}
                          rubricKey="final-output"
                          borderColor="border-purple-200"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {latestFinalOutputRubric?.isGenerating && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating question from feedback...
                  </div>
                )}

                {finalOutputFeedback.length > 0 && (
                  <RubricGenerator
                    systemPrompt={currentConfig?.systemPrompt || "AI Agent"}
                    {...convertFeedbackToExamples(finalOutputFeedback)}
                    existingRubric={latestFinalOutputRubric?.questions}
                    applyRubric={(questions) => handleApplyRubric("final-output", questions)}
                  />
                )}

                <div className="flex gap-2">
                  {finalOutputRubrics.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedRubricKey("final-output")
                          setShowQuestions(true)
                        }}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Questions
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedRubricKey("final-output")
                          setShowVersionHistory(true)
                        }}
                        className="gap-2"
                      >
                        <History className="w-4 h-4" />
                        History
                      </Button>
                    </>
                  )}
                  {finalOutputFeedback.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedRubricKey("final-output")
                        setShowFeedbackReview(true)
                      }}
                      className="gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Feedback
                    </Button>
                  )}
                </div>

                <div className="pt-3 border-t">
                  <div className="text-xs text-muted-foreground">Feedback Distribution</div>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="gap-1">
                      👍 {finalOutputFeedback.filter((f) => f.rating === "up").length}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      👎 {finalOutputFeedback.filter((f) => f.rating === "down").length}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5" />
              <h3 className="text-xl font-semibold">Thinking Steps</h3>
            </div>

            <Card className="p-6 bg-green-50 border-l-4 border-l-green-500">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div>
                    <h4 className="text-lg font-semibold mb-1 text-green-700">Thinking Evaluation</h4>
                    <p className="text-sm text-muted-foreground">
                      {thinkingFeedback.length === 0
                        ? "no judges defined"
                        : `${thinkingFeedback.length} feedback items collected`}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-green-700 hover:text-green-900 hover:bg-green-100"
                    onClick={() => openAddQuestionDialog("thinking")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {thinkingRubrics.length > 0 && <Badge variant="secondary">v{latestThinkingRubric.version}</Badge>}
              </div>

              <div className="space-y-3">
                {latestThinkingRubric && latestThinkingRubric.questions.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Current Questions:</div>
                    <div className="space-y-2">
                      {latestThinkingRubric.questions.map((q, i) => (
                        <QuestionCard
                          key={i}
                          question={q}
                          index={i}
                          rubricKey="thinking"
                          borderColor="border-green-200"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {latestThinkingRubric?.isGenerating && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating question from feedback...
                  </div>
                )}

                {thinkingFeedback.length > 0 && (
                  <RubricGenerator
                    systemPrompt={`${currentConfig?.systemPrompt || "AI Agent"} - Thinking Process`}
                    {...convertFeedbackToExamples(thinkingFeedback)}
                    existingRubric={latestThinkingRubric?.questions}
                    applyRubric={(questions) => handleApplyRubric("thinking", questions)}
                  />
                )}

                <div className="flex gap-2">
                  {thinkingRubrics.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedRubricKey("thinking")
                          setShowQuestions(true)
                        }}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Questions
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedRubricKey("thinking")
                          setShowVersionHistory(true)
                        }}
                        className="gap-2"
                      >
                        <History className="w-4 h-4" />
                        History
                      </Button>
                    </>
                  )}
                  {thinkingFeedback.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedRubricKey("thinking")
                        setShowFeedbackReview(true)
                      }}
                      className="gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Feedback
                    </Button>
                  )}
                </div>

                <div className="pt-3 border-t">
                  <div className="text-xs text-muted-foreground">Feedback Distribution</div>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="gap-1">
                      👍 {thinkingFeedback.filter((f) => f.rating === "up").length}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      👎 {thinkingFeedback.filter((f) => f.rating === "down").length}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Action Steps Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-xl font-semibold">Action Steps</h3>
            </div>

            {toolNames.length === 0 ? (
              <Card className="p-6">
                <p className="text-sm text-muted-foreground text-center">
                  No action steps yet. Run the agent to see tool-specific rubrics here.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {toolNames.map((toolName) => {
                  const toolCallKey = `${toolName}:tool-call`
                  const toolResultKey = `${toolName}:tool-result`

                  const toolCallFeedback = getFeedbackByToolNameAndType(toolName, "tool-call")
                  const toolResultFeedback = getFeedbackByToolNameAndType(toolName, "tool-result")

                  const toolCallRubrics = getRubricsByToolNameAndType(toolName, "tool-call")
                  const toolResultRubrics = getRubricsByToolNameAndType(toolName, "tool-result")

                  const latestToolCallRubric = toolCallRubrics[toolCallRubrics.length - 1]
                  const latestToolResultRubric = toolResultRubrics[toolResultRubrics.length - 1]

                  return (
                    <div key={toolName} className="space-y-4">
                      {/* Tool Call Rubric Card */}
                      <Card className="p-6 bg-blue-50 border-l-4 border-l-blue-500">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <h4 className="text-lg font-semibold mb-1 text-blue-700">{toolName}</h4>
                              <p className="text-xs text-blue-600 mb-1">Tool Call Evaluation</p>
                              <p className="text-sm text-muted-foreground">
                                {toolCallFeedback.length === 0
                                  ? "no judges defined"
                                  : `${toolCallFeedback.length} feedback items collected`}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                              onClick={() => openAddQuestionDialog(toolCallKey)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {toolCallRubrics.length > 0 && (
                            <Badge variant="secondary">v{latestToolCallRubric.version}</Badge>
                          )}
                        </div>

                        <div className="space-y-3">
                          {latestToolCallRubric && latestToolCallRubric.questions.length > 0 && (
                            <div className="mb-3">
                              <div className="text-xs font-medium text-muted-foreground mb-2">Current Questions:</div>
                              <div className="space-y-2">
                                {latestToolCallRubric.questions.map((q, i) => (
                                  <QuestionCard
                                    key={i}
                                    question={q}
                                    index={i}
                                    rubricKey={toolCallKey}
                                    borderColor="border-blue-200"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {latestToolCallRubric?.isGenerating && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Generating question from feedback...
                            </div>
                          )}

                          {toolCallFeedback.length > 0 && (
                            <RubricGenerator
                              systemPrompt={`${currentConfig?.systemPrompt || "AI Agent"} - Tool Call: ${toolName}`}
                              {...convertFeedbackToExamples(toolCallFeedback)}
                              existingRubric={latestToolCallRubric?.questions}
                              applyRubric={(questions) => handleApplyRubric(toolCallKey, questions)}
                            />
                          )}

                          <div className="flex gap-2">
                            {toolCallRubrics.length > 0 && (
                              <>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRubricKey(toolCallKey)
                                    setShowQuestions(true)
                                  }}
                                  className="gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  Questions
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRubricKey(toolCallKey)
                                    setShowVersionHistory(true)
                                  }}
                                  className="gap-2"
                                >
                                  <History className="w-4 h-4" />
                                  History
                                </Button>
                              </>
                            )}
                            {toolCallFeedback.length > 0 && (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedRubricKey(toolCallKey)
                                  setShowFeedbackReview(true)
                                }}
                                className="gap-2"
                              >
                                <MessageSquare className="w-4 h-4" />
                                Feedback
                              </Button>
                            )}
                          </div>

                          <div className="pt-3 border-t">
                            <div className="text-xs text-muted-foreground">Feedback Distribution</div>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline" className="gap-1">
                                👍 {toolCallFeedback.filter((f) => f.rating === "up").length}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                👎 {toolCallFeedback.filter((f) => f.rating === "down").length}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Card>

                      {/* Tool Result Rubric Card */}
                      <Card className="p-6 bg-orange-50 border-l-4 border-l-orange-500">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <h4 className="text-lg font-semibold mb-1 text-orange-700">{toolName}</h4>
                              <p className="text-xs text-orange-600 mb-1">Tool Result Evaluation</p>
                              <p className="text-sm text-muted-foreground">
                                {toolResultFeedback.length === 0
                                  ? "no judges defined"
                                  : `${toolResultFeedback.length} feedback items collected`}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-orange-700 hover:text-orange-900 hover:bg-orange-100"
                              onClick={() => openAddQuestionDialog(toolResultKey)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {toolResultRubrics.length > 0 && (
                            <Badge variant="secondary">v{latestToolResultRubric.version}</Badge>
                          )}
                        </div>

                        <div className="space-y-3">
                          {latestToolResultRubric && latestToolResultRubric.questions.length > 0 && (
                            <div className="mb-3">
                              <div className="text-xs font-medium text-muted-foreground mb-2">Current Questions:</div>
                              <div className="space-y-2">
                                {latestToolResultRubric.questions.map((q, i) => (
                                  <QuestionCard
                                    key={i}
                                    question={q}
                                    index={i}
                                    rubricKey={toolResultKey}
                                    borderColor="border-orange-200"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {latestToolResultRubric?.isGenerating && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Generating question from feedback...
                            </div>
                          )}

                          {toolResultFeedback.length > 0 && (
                            <RubricGenerator
                              systemPrompt={`${currentConfig?.systemPrompt || "AI Agent"} - Tool Result: ${toolName}`}
                              {...convertFeedbackToExamples(toolResultFeedback)}
                              existingRubric={latestToolResultRubric?.questions}
                              applyRubric={(questions) => handleApplyRubric(toolResultKey, questions)}
                            />
                          )}

                          <div className="flex gap-2">
                            {toolResultRubrics.length > 0 && (
                              <>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRubricKey(toolResultKey)
                                    setShowQuestions(true)
                                  }}
                                  className="gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  Questions
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRubricKey(toolResultKey)
                                    setShowVersionHistory(true)
                                  }}
                                  className="gap-2"
                                >
                                  <History className="w-4 h-4" />
                                  History
                                </Button>
                              </>
                            )}
                            {toolResultFeedback.length > 0 && (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedRubricKey(toolResultKey)
                                  setShowFeedbackReview(true)
                                }}
                                className="gap-2"
                              >
                                <MessageSquare className="w-4 h-4" />
                                Feedback
                              </Button>
                            )}
                          </div>

                          <div className="pt-3 border-t">
                            <div className="text-xs text-muted-foreground">Feedback Distribution</div>
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline" className="gap-1">
                                👍 {toolResultFeedback.filter((f) => f.rating === "up").length}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                👎 {toolResultFeedback.filter((f) => f.rating === "down").length}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Version History Dialog */}
      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRubricKey === "final-output"
                ? "Final Output"
                : selectedRubricKey === "thinking"
                  ? "Thinking Steps"
                  : selectedRubricKey?.includes("tool-call")
                    ? `${selectedRubricKey.split(":")[0]} - Tool Call`
                    : `${selectedRubricKey?.split(":")[0]} - Tool Result`}{" "}
              Rubric Version History
            </DialogTitle>
            <DialogDescription>View all versions of rubrics created for this evaluation</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-4">
              {selectedRubricKey &&
                getRubricsForKey(selectedRubricKey)
                  .reverse()
                  .map((rubric) => (
                    <Card key={rubric.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <Badge variant="secondary">Version {rubric.version}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(rubric.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {rubric.feedbackCount} feedback items • {rubric.questions.length} questions
                        </div>
                      </div>
                      <div className="space-y-2">
                        {rubric.questions.map((q, i) => (
                          <div key={i} className="text-sm p-2 bg-muted rounded">
                            <div className="font-medium">{q.label}</div>
                            <div className="text-muted-foreground">{q.question}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Questions Dialog */}
      <Dialog open={showQuestions} onOpenChange={setShowQuestions}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRubricKey === "final-output"
                ? "Final Output"
                : selectedRubricKey === "thinking"
                  ? "Thinking Steps"
                  : selectedRubricKey?.includes("tool-call")
                    ? `${selectedRubricKey.split(":")[0]} - Tool Call`
                    : `${selectedRubricKey?.split(":")[0]} - Tool Result`}{" "}
              Current Questions
            </DialogTitle>
            <DialogDescription>Questions used to evaluate this rubric</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-3">
              {selectedRubricKey &&
                getRubricsForKey(selectedRubricKey)
                  .slice(-1)[0]
                  ?.questions.map((q, i) => (
                    <Card key={i} className="p-4">
                      <div className="font-semibold mb-1">{q.label}</div>
                      <div className="text-sm text-muted-foreground">{q.question}</div>
                    </Card>
                  ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Feedback Review Dialog */}
      <Dialog open={showFeedbackReview} onOpenChange={setShowFeedbackReview}>
        <DialogContent className="w-full sm:max-w-7xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRubricKey === "final-output"
                ? "Final Output"
                : selectedRubricKey === "thinking"
                  ? "Thinking Steps"
                  : selectedRubricKey?.includes("tool-call")
                    ? `${selectedRubricKey.split(":")[0]} - Tool Call`
                    : `${selectedRubricKey?.split(":")[0]} - Tool Result`}{" "}
              Feedback Review
            </DialogTitle>
            <DialogDescription>Review all feedback collected for this rubric</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-4">
              {selectedRubricKey &&
                getFeedbackForKey(selectedRubricKey).map((feedback) => (
                  <Card key={feedback.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant={feedback.rating === "up" ? "default" : "destructive"}>
                        {feedback.rating === "up" ? "👍 Positive" : "👎 Negative"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(feedback.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Feedback:</div>
                        <p className="text-sm">{feedback.description}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Input:</div>
                          <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96 border">
                            {JSON.stringify(JSON.parse(feedback.input), null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Output:</div>
                          <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96 border">
                            {typeof feedback.output === "string" && feedback.output.startsWith("{")
                              ? JSON.stringify(JSON.parse(feedback.output), null, 2)
                              : feedback.output}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={editingQuestion !== null} onOpenChange={() => setEditingQuestion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Modify the question label and text. This will create a new rubric version.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-label">Question Label</Label>
              <Input
                id="edit-label"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="e.g., Timeliness of Search Action"
              />
            </div>
            <div>
              <Label htmlFor="edit-question">Question Text</Label>
              <Textarea
                id="edit-question"
                value={editQuestionText}
                onChange={(e) => setEditQuestionText(e.target.value)}
                placeholder="e.g., Does the agent initiate the search early enough?"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingQuestion(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingQuestion && selectedRubricKey) {
                    handleEditQuestion(selectedRubricKey, editingQuestion.index, {
                      label: editLabel,
                      question: editQuestionText,
                    })
                  }
                }}
                disabled={!editLabel.trim() || !editQuestionText.trim()}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddQuestion} onOpenChange={setShowAddQuestion}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Judge</DialogTitle>
            <DialogDescription>
              Create a new evaluation criterion for this rubric. This will create a new rubric version.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="criteria-name">Criteria Name</Label>
              <Input
                id="criteria-name"
                value={newCriteriaName}
                onChange={(e) => setNewCriteriaName(e.target.value)}
                placeholder="e.g., Timeliness of Search Action"
              />
            </div>
            <div>
              <Label htmlFor="criteria-description">Description</Label>
              <Textarea
                id="criteria-description"
                value={newCriteriaDescription}
                onChange={(e) => setNewCriteriaDescription(e.target.value)}
                placeholder="e.g., Does the agent initiate the search early enough?"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddQuestion(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddQuestion} disabled={!newCriteriaName.trim() || !newCriteriaDescription.trim()}>
                Add Judge
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
