"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Play,
  Square,
  Bot,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Search,
  Plus,
  Edit,
  Trash2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Github,
} from "lucide-react"

interface TraceEntry {
  id: string
  type: "thinking" | "action" | "observation" | "final"
  content: string
  timestamp: Date
}

interface EvaluationResult {
  id: string
  configurationHash: string
  configurationName: string
  userPrompt: string
  finalOutput: string
  timestamp: Date
  traces: TraceEntry[]
  isExecuting?: boolean // Added executing state flag
  model: string
  usePiJudge: boolean
}

interface LabeledDataEntry {
  id: string
  traceId: string
  fullTrace: TraceEntry[]
  feedback: "positive" | "negative"
  note: string
  timestamp: Date
  configurationName: string
  userPrompt: string
}

interface FeedbackModalProps {
  traceId: string
  isPositive: boolean
  onClose: () => void
  onSubmit: (feedback: string) => void
}

function FeedbackModal({ traceId, isPositive, onClose, onSubmit }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log(`Feedback for trace ${traceId}:`, { isPositive, feedback })
    onSubmit(feedback)
    setIsSubmitting(false)
    onClose()
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {isPositive ? (
            <ThumbsUp className="h-5 w-5 text-green-600" />
          ) : (
            <ThumbsDown className="h-5 w-5 text-red-600" />
          )}
          {isPositive ? "Positive" : "Negative"} Feedback
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Help us improve by sharing your thoughts on this trace step.</p>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What did you think about this step? (optional)"
          className="min-h-[100px]"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

export default function AgentTracePage() {
  const [goal, setGoal] = useState("Plan a trip")
  const [userPrompt, setUserPrompt] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [traces, setTraces] = useState<TraceEntry[]>([])
  const [feedbackModal, setFeedbackModal] = useState<{ traceId: string; isPositive: boolean } | null>(null)
  const [isLeftPaneCollapsed, setIsLeftPaneCollapsed] = useState(false)
  const [currentPage, setCurrentPage] = useState("Build Agent")
  const [evaluationResults, setEvaluationResults] = useState<EvaluationResult[]>([])
  const [selectedModel, setSelectedModel] = useState("gpt-4")
  const [usePiJudge, setUsePiJudge] = useState(false)
  const [labeledData, setLabeledData] = useState<LabeledDataEntry[]>([])
  const traceEndRef = useRef<HTMLDivElement>(null)
  const isRunningRef = useRef(false)

  const [tools, setTools] = useState([
    {
      id: "1",
      name: "restaurant_search",
      description: "Find restaurants by location and cuisine type",
      params: "(location, cuisine)",
    },
    { id: "2", name: "map_tool", description: "Get coordinates, distances, and optimal routes", params: "(locations)" },
  ])

  const addTrace = (type: TraceEntry["type"], content: string) => {
    const newTrace: TraceEntry = {
      id: Date.now().toString() + Math.random(),
      type,
      content,
      timestamp: new Date(),
    }
    setTraces((prev) => [...prev, newTrace])
  }

  const clearTrace = () => {
    setTraces([])
  }

  const getConfigurationHash = () => {
    return `${goal.slice(0, 30)}... (${selectedModel}${usePiJudge ? ", Pi Judge" : ""})`
  }

  // Auto-scroll to bottom when new traces are added
  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [traces])

  const runAgent = async () => {
    if (!userPrompt.trim()) {
      alert("Please enter a prompt first")
      return
    }

    console.log("[v0] Starting agent execution with:", { userPrompt, selectedModel, goal })
    setIsRunning(true)
    isRunningRef.current = true
    clearTrace()

    const executingResult: EvaluationResult = {
      id: Date.now().toString() + Math.random(),
      configurationHash: getConfigurationHash(),
      configurationName: getConfigurationHash(),
      userPrompt: userPrompt,
      finalOutput: "executing",
      timestamp: new Date(),
      traces: [],
      isExecuting: true,
      model: selectedModel,
      usePiJudge: usePiJudge,
    }
    setEvaluationResults((prev) => [...prev, executingResult])

    try {
      console.log("[v0] Making API request to /api/agent")
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goal: userPrompt,
          model: selectedModel,
          systemPrompt: goal,
        }),
      })

      console.log("[v0] API response status:", response.status)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response body")
      }

      console.log("[v0] Starting to read stream")
      const decoder = new TextDecoder()
      const currentTraces: TraceEntry[] = []

      while (true) {
        if (!isRunningRef.current) {
          console.log("[v0] Stopping execution - isRunning is false")
          reader.cancel()
          return
        }

        const { done, value } = await reader.read()
        console.log("[v0] Stream read:", { done, valueLength: value?.length })

        if (done) {
          console.log("[v0] Stream completed")
          break
        }

        const chunk = decoder.decode(value)
        console.log("[v0] Decoded chunk:", chunk)
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              console.log("[v0] Parsed SSE data:", data)

              const newTrace: TraceEntry = {
                id: Date.now().toString() + Math.random(),
                type: data.type,
                content: data.content,
                timestamp: new Date(),
              }

              currentTraces.push(newTrace)
              addTrace(data.type, data.content)

              // If this is the final trace, update the evaluation result
              if (data.type === "final") {
                console.log("[v0] Final trace received, updating evaluation result")
                setEvaluationResults((prev) =>
                  prev.map((result) =>
                    result.id === executingResult.id
                      ? {
                          ...result,
                          finalOutput: data.content,
                          traces: currentTraces,
                          isExecuting: false,
                        }
                      : result,
                  ),
                )
              }
            } catch (e) {
              console.error("[v0] Error parsing SSE data:", e, "Line:", line)
            }
          }
        }
      }
    } catch (error) {
      console.error("[v0] Error running agent:", error)
      addTrace("final", `Error: ${error instanceof Error ? error.message : "Unknown error"}`)

      // Remove the executing result on error
      setEvaluationResults((prev) => prev.filter((result) => result.id !== executingResult.id))
    }

    console.log("[v0] Agent execution completed")
    setIsRunning(false)
    isRunningRef.current = false
  }

  const stopAgent = () => {
    setIsRunning(false)
    isRunningRef.current = false
  }

  const handleFeedback = (traceId: string, isPositive: boolean) => {
    setFeedbackModal({ traceId, isPositive })
  }

  const handleFeedbackSubmit = (traceId: string, isPositive: boolean, note: string) => {
    const newLabeledEntry: LabeledDataEntry = {
      id: Date.now().toString() + Math.random(),
      traceId,
      fullTrace: [...traces], // Copy current traces
      feedback: isPositive ? "positive" : "negative",
      note,
      timestamp: new Date(),
      configurationName: getConfigurationHash(),
      userPrompt: userPrompt,
    }
    setLabeledData((prev) => [...prev, newLabeledEntry])
  }

  const getTraceColor = (type: TraceEntry["type"]) => {
    switch (type) {
      case "thinking":
        return "border-l-green-500 bg-green-50 dark:bg-green-950/20"
      case "action":
        return "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20"
      case "observation":
        return "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20"
      case "final":
        return "border-l-pink-500 bg-pink-50 dark:bg-pink-950/20"
      default:
        return "border-l-gray-500 bg-gray-50 dark:bg-gray-950/20"
    }
  }

  const getBadgeColor = (type: TraceEntry["type"]) => {
    switch (type) {
      case "thinking":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "action":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "observation":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      case "final":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const handleAddTool = () => {
    console.log("[v0] Add new tool clicked")
  }

  const handleEditTool = (toolId: string) => {
    console.log("[v0] Edit tool clicked:", toolId)
  }

  const handleDeleteTool = (toolId: string) => {
    setTools(tools.filter((tool) => tool.id !== toolId))
  }

  const handleToolClick = (toolId: string) => {
    console.log("[v0] Tool clicked:", toolId)
  }

  const getUniqueConfigurations = () => {
    const configs = new Set(evaluationResults.map((r) => r.configurationName))
    return Array.from(configs)
  }

  const getUniquePrompts = () => {
    const prompts = new Set(evaluationResults.map((r) => r.userPrompt))
    return Array.from(prompts)
  }

  const getResultForCell = (configName: string, prompt: string) => {
    return evaluationResults.find((r) => r.configurationName === configName && r.userPrompt === prompt)
  }

  const truncateText = (text: string, maxLength = 100) => {
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text
  }

  const loadConfigurationFromEvaluation = (result: EvaluationResult) => {
    setGoal(result.configurationName.split("...")[0] + "...") // Extract system prompt from config name
    setCurrentPage("Build Agent")
    setUserPrompt("") // Clear user prompt
    setTraces([]) // Clear any existing traces
    setIsRunning(false) // Ensure not in running state
    setSelectedModel(result.model)
    setUsePiJudge(result.usePiJudge)
  }

  const loadFullResultFromEvaluation = (result: EvaluationResult) => {
    // Load configuration, prompt, and traces
    setGoal(result.configurationName.split("...")[0] + "...") // Extract system prompt from config name
    setUserPrompt(result.userPrompt)
    setTraces(result.traces)
    setCurrentPage("Build Agent")
    setSelectedModel(result.model)
    setUsePiJudge(result.usePiJudge)
  }

  const renderEvaluationTable = () => {
    const configurations = getUniqueConfigurations()
    const prompts = getUniquePrompts()

    if (configurations.length === 0 || prompts.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <p className="mb-2">No evaluation results yet.</p>
            <p className="text-sm">Switch to "Build Agent" and run some traces to populate this table.</p>
          </div>
        </div>
      )
    }

    return (
      <div className="overflow-auto h-full">
        <table className="w-full border-collapse border border-border">
          <thead>
            <tr>
              <th className="border border-border p-3 bg-muted/50 text-left font-medium w-64">Configuration</th>
              {prompts.map((prompt, index) => (
                <th key={index} className="border border-border p-3 bg-muted/50 text-left font-medium min-w-[200px]">
                  {truncateText(prompt, 50)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {configurations.map((config, configIndex) => {
              const configResult = evaluationResults.find((r) => r.configurationName === config)
              const modelName = configResult?.model || selectedModel
              const isPiJudgeEnabled = configResult?.usePiJudge || false

              return (
                <tr key={configIndex}>
                  <td
                    className="border border-border p-3 font-medium bg-muted/30 w-64 align-top cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => configResult && loadConfigurationFromEvaluation(configResult)}
                    title="Click to load this configuration in Build Agent"
                  >
                    <div className="space-y-2 mb-3">
                      <Badge variant="secondary" className="text-xs">
                        {modelName}
                      </Badge>
                      <Badge variant={isPiJudgeEnabled ? "default" : "outline"} className="text-xs">
                        {isPiJudgeEnabled ? "Using Pi Judge" : "Not using Pi Judge"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{truncateText(goal, 80)}</div>
                  </td>
                  {prompts.map((prompt, promptIndex) => {
                    const result = getResultForCell(config, prompt)
                    return (
                      <td
                        key={promptIndex}
                        className={`border border-border p-3 align-top ${
                          result && !result.isExecuting ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""
                        }`}
                        onClick={() => result && !result.isExecuting && loadFullResultFromEvaluation(result)}
                        title={result && !result.isExecuting ? "Click to load this result in Build Agent" : undefined}
                      >
                        {result ? (
                          <div className="space-y-2">
                            {result.isExecuting ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className="animate-spin h-3 w-3 border border-border border-t-primary rounded-full"></div>
                                  <span className="text-sm text-muted-foreground">Executing...</span>
                                </div>
                                <div className="space-y-1">
                                  <div className="h-3 bg-muted/50 rounded animate-pulse"></div>
                                  <div className="h-3 bg-muted/50 rounded animate-pulse w-3/4"></div>
                                  <div className="h-3 bg-muted/50 rounded animate-pulse w-1/2"></div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="text-sm font-mono leading-relaxed">
                                  {truncateText(result.finalOutput, 150)}
                                </div>
                                <div className="text-xs text-muted-foreground">{result.timestamp.toLocaleString()}</div>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-sm italic">No result</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderLabeledDataTable = () => {
    if (labeledData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <p className="mb-2">No labeled data yet.</p>
            <p className="text-sm">Provide feedback on trace steps to populate this table.</p>
          </div>
        </div>
      )
    }

    return (
      <div className="overflow-auto h-full">
        <table className="w-full border-collapse border border-border">
          <thead>
            <tr>
              <th className="border border-border p-3 bg-muted/50 text-left font-medium flex-1">Full Trace (JSON)</th>
              <th className="border border-border p-3 bg-muted/50 text-left font-medium w-24">Feedback</th>
              <th className="border border-border p-3 bg-muted/50 text-left font-medium w-64">Note</th>
              <th className="border border-border p-3 bg-muted/50 text-left font-medium w-32">Timestamp</th>
              <th className="border border-border p-3 bg-muted/50 text-left font-medium w-64">Configuration</th>
            </tr>
          </thead>
          <tbody>
            {labeledData.map((entry) => {
              const configParts = entry.configurationName.split("(")[1]?.split(")")[0] || ""
              const modelMatch = configParts.split(",")[0] || "gpt-4"
              const isPiJudgeEnabled = configParts.includes("Pi Judge")
              const systemPrompt = entry.configurationName.split("...")[0] + "..."

              return (
                <tr key={entry.id}>
                  <td className="border border-border p-3 align-top">
                    <div className="text-xs font-mono bg-muted/30 p-2 rounded max-h-32 overflow-y-auto">
                      <pre className="whitespace-pre-wrap">{JSON.stringify(entry.fullTrace, null, 2)}</pre>
                    </div>
                  </td>
                  <td className="border border-border p-3 align-top text-center">
                    {entry.feedback === "positive" ? (
                      <ThumbsUp className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <ThumbsDown className="h-4 w-4 text-red-600 mx-auto" />
                    )}
                  </td>
                  <td className="border border-border p-3 align-top">
                    <div className="text-sm">
                      {entry.note || <span className="text-muted-foreground italic">No note</span>}
                    </div>
                  </td>
                  <td className="border border-border p-3 align-top">
                    <div className="text-xs text-muted-foreground">{entry.timestamp.toLocaleString()}</div>
                  </td>
                  <td className="border border-border p-3 align-top w-64">
                    <div className="space-y-2 mb-3">
                      <Badge
                        variant="secondary"
                        className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      >
                        {modelMatch}
                      </Badge>
                      <Badge
                        variant={isPiJudgeEnabled ? "default" : "outline"}
                        className={`text-xs ${
                          isPiJudgeEnabled
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }`}
                      >
                        {isPiJudgeEnabled ? "Using Pi Judge" : "Not using Pi Judge"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{truncateText(systemPrompt, 80)}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderEvaluationRubric = () => {
    return (
      <div className="h-[80vh] flex flex-col">
        <h1 className="text-2xl font-bold mb-6">Evaluation Rubric</h1>
        <div className="flex-1 p-6 border rounded-lg">
          <div className="space-y-6 h-full">
            <div className="flex-1">
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-medium mb-2">Evaluation Criteria</h2>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium text-sm mb-1">Task Completion</div>
                      <div className="text-xs text-muted-foreground">
                        Did the agent successfully complete the requested task?
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium text-sm mb-1">Tool Usage</div>
                      <div className="text-xs text-muted-foreground">Were the appropriate tools used effectively?</div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium text-sm mb-1">Reasoning Quality</div>
                      <div className="text-xs text-muted-foreground">
                        Was the agent's reasoning logical and well-structured?
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="font-medium text-sm mb-1">Efficiency</div>
                      <div className="text-xs text-muted-foreground">
                        Did the agent complete the task in a reasonable number of steps?
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h2 className="text-sm font-medium mb-2">Overall Score</h2>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-muted-foreground">--</div>
                    <div className="text-xs text-muted-foreground mt-1">Run agent to see evaluation</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bot className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Pi Agent Builder </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={currentPage === "Build Agent" ? "default" : "outline"}
              className="text-sm"
              onClick={() => setCurrentPage("Build Agent")}
            >
              Build Agent
            </Button>
            <Button
              variant={currentPage === "Evaluation Rubric" ? "default" : "outline"}
              className="text-sm"
              onClick={() => setCurrentPage("Evaluation Rubric")}
            >
              Evaluation Rubric
            </Button>
            <Button
              variant={currentPage === "Evaluate Agent" ? "default" : "outline"}
              className="text-sm"
              onClick={() => setCurrentPage("Evaluate Agent")}
            >
              Evaluate Agent
            </Button>
            <Button
              variant={currentPage === "Labeled Data" ? "default" : "outline"}
              className="text-sm"
              onClick={() => setCurrentPage("Labeled Data")}
            >
              Labeled Data ({labeledData.length})
            </Button>
            <Button
              variant="outline"
              className="text-sm bg-transparent"
              onClick={() => window.open("https://github.com/your-username/pi-agent-builder", "_blank")}
            >
              <Github className="h-4 w-4 mr-2" />
              GitHub
            </Button>
          </div>
        </div>

        {currentPage === "Build Agent" ? (
          <div className="flex h-[80vh] gap-0">
            {/* Left Pane - Clean Configuration */}
            <div className={`transition-all duration-300 ${isLeftPaneCollapsed ? "w-0" : "w-96"} flex-shrink-0`}>
              <div
                className={`h-full overflow-hidden py-[0] ${isLeftPaneCollapsed ? "opacity-0" : "opacity-100"} transition-opacity duration-300 p-6`}
              >
                <div className="space-y-6 h-full">
                  <h1 className="text-2xl font-bold mb-6">Agent Configuration</h1>
                  <div>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="model" className="block text-sm font-medium mb-2">
                          Model
                        </label>
                        <select
                          id="model"
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                          disabled={isRunning}
                        >
                          <option value="gpt-4">GPT-4</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                          <option value="claude-3-opus">Claude 3 Opus</option>
                          <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                          <option value="claude-3-haiku">Claude 3 Haiku</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label htmlFor="pi-judge" className="text-sm font-medium">
                            Use Pi Judge as Guardrail
                          </label>
                          <button
                            id="pi-judge"
                            type="button"
                            onClick={() => setUsePiJudge(!usePiJudge)}
                            disabled={isRunning}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                              usePiJudge ? "bg-primary" : "bg-input"
                            } ${isRunning ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                                usePiJudge ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enable Pi Judge to improve agent's tool calling and reasoning
                        </p>
                      </div>

                      <div>
                        <label htmlFor="goal" className="block text-sm font-medium mb-2">
                          System Prompt
                        </label>
                        <Textarea
                          id="goal"
                          value={goal}
                          onChange={(e) => setGoal(e.target.value)}
                          placeholder="Enter system instructions for the agent..."
                          className="min-h-[120px] font-mono"
                          disabled={isRunning}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-medium">Available Tools</h2>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleAddTool}
                        className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/20"
                      >
                        <Plus className="h-4 w-4 text-blue-600" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {tools.map((tool) => (
                        <div
                          key={tool.id}
                          onClick={() => handleToolClick(tool.id)}
                          className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-sm font-medium text-foreground">
                                {tool.name}
                                {tool.params}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 truncate">{tool.description}</div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditTool(tool.id)
                                }}
                                className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-950/20"
                              >
                                <Edit className="h-3 w-3 text-blue-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteTool(tool.id)
                                }}
                                className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-950/20"
                              >
                                <Trash2 className="h-3 w-3 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          <strong>Mock Agent</strong> - Simulated execution with sample data
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-start pt-4 bg-border w-px relative">
              <div className="flex flex-col items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsLeftPaneCollapsed(!isLeftPaneCollapsed)}
                  className="h-8 w-8 p-0 bg-background border border-border rounded-full shadow-sm hover:shadow-md transition-shadow"
                  title="Agent configuration"
                >
                  {isLeftPaneCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Middle Pane - Execute (now takes full remaining width) */}
            <div className="flex-1 mx-6 flex flex-col">
              <h1 className="text-2xl font-bold mb-6">Execute</h1>
              <div className="mb-4">
                <h2 className="text-sm font-medium mb-4">User Prompt</h2>
                <div className="flex gap-3">
                  <Textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Enter your prompt here (e.g., 'Plan a day trip to downtown with good restaurants')"
                    className="flex-1 min-h-[60px] resize-none"
                    disabled={isRunning}
                  />
                  <div className="flex flex-col gap-2">
                    <Button onClick={runAgent} disabled={isRunning} className="whitespace-nowrap">
                      <Play className="h-4 w-4 mr-2" />
                      Run Agent
                    </Button>
                    <Button
                      onClick={stopAgent}
                      disabled={!isRunning}
                      variant="destructive"
                      className="whitespace-nowrap"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <h2 className="text-sm font-medium mb-4">Agent Execution Trace</h2>
                <div className="flex-1 overflow-hidden">
                  <div className="h-full overflow-y-auto space-y-3 pr-2">
                    {traces.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>No traces yet. Run the agent to see execution steps.</p>
                      </div>
                    ) : (
                      traces.map((trace, index) => (
                        <div key={trace.id}>
                          <div className={`border-l-4 p-4 rounded-r-lg ${getTraceColor(trace.type)}`}>
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={getBadgeColor(trace.type)}>{trace.type.toUpperCase()}</Badge>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {trace.timestamp.toLocaleTimeString()}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 hover:bg-green-100 dark:hover:bg-green-900/20"
                                    onClick={() => handleFeedback(trace.id, true)}
                                  >
                                    <ThumbsUp className="h-3 w-3 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                                    onClick={() => handleFeedback(trace.id, false)}
                                  >
                                    <ThumbsDown className="h-3 w-3 text-red-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-950/20"
                                    onClick={() => console.log(`[v0] Inspecting trace ${trace.id}:`, trace)}
                                  >
                                    <Search className="h-3 w-3 text-blue-600" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <p className="text-sm font-mono leading-relaxed">{trace.content}</p>
                          </div>
                          {index < traces.length - 1 && (
                            <div className="flex justify-center py-2">
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    <div ref={traceEndRef} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : currentPage === "Evaluate Agent" ? (
          <div className="h-[80vh] flex flex-col">
            <h1 className="text-2xl font-bold mb-6">Agent Evaluation Results</h1>
            <div className="flex-1 border rounded-lg overflow-hidden">{renderEvaluationTable()}</div>
          </div>
        ) : currentPage === "Labeled Data" ? (
          <div className="h-[80vh] flex flex-col">
            <h1 className="text-2xl font-bold mb-6">Labeled Training Data</h1>
            <div className="flex-1 border rounded-lg overflow-hidden">{renderLabeledDataTable()}</div>
          </div>
        ) : (
          renderEvaluationRubric()
        )}
      </div>

      <Dialog open={!!feedbackModal} onOpenChange={() => setFeedbackModal(null)}>
        {feedbackModal && (
          <FeedbackModal
            traceId={feedbackModal.traceId}
            isPositive={feedbackModal.isPositive}
            onClose={() => setFeedbackModal(null)}
            onSubmit={(note) => handleFeedbackSubmit(feedbackModal.traceId, feedbackModal.isPositive, note)}
          />
        )}
      </Dialog>
    </div>
  )
}
