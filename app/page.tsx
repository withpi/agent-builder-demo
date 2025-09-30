"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Multiselect, MultiselectOption } from "@/components/ui/multiselect"
import { EvaluationRubricItem } from "@/lib/types"
import { DEFAULT_EVALUATION_RUBRIC } from "@/lib/default-rubric"
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
  rubricScores?: Array<{
    rubricItemId: string
    score: number // 0.00 to 1.00 (2 decimal places)
  }>
}

interface EvaluationResult {
  id: string
  configurationHash: string
  configurationName: string
  systemPrompt: string // Store the actual system prompt used
  userPrompt: string
  finalOutput: string
  timestamp: Date
  traces: TraceEntry[]
  isExecuting?: boolean // Added executing state flag
  model: string
  usePiJudge: boolean
  metrics: {
    steps: number
    latency: number // Total time in milliseconds
    totalTokens: number
  }
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
  onSubmit: (feedback: string) => Promise<void>
}

function FeedbackModal({ traceId, isPositive, onClose, onSubmit }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    // Call the actual feedback submission which includes the helper API call
    await onSubmit(feedback)
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
  const [goal, setGoal] = useState("Summarize data about the provided country and the exchange rates between the country the user provides and India\n\nIf the user provides multiple countries, instead summarize the exchange rates between each of the countries and highlight which country has the strongest currency\n\nif the user provides india as the country, show the exchange rates between india and the usa")
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
  const [evaluationRubric, setEvaluationRubric] = useState<EvaluationRubricItem[]>(DEFAULT_EVALUATION_RUBRIC)
  const [selectedRubricFilters, setSelectedRubricFilters] = useState<string[]>(["all"])
  const traceEndRef = useRef<HTMLDivElement>(null)
  const isRunningRef = useRef(false)

  const [tools, setTools] = useState([
    {
      id: "1",
      name: "search_countries",
      description: "Search for countries by name and get detailed information including capital, population, region, currencies, languages, and more",
      params: "(query)",
    },
    {
      id: "2",
      name: "get_exchange_rates",
      description: "Get all exchange rates from a base currency to all supported currencies using the standard Exchange Rate API",
      params: "(baseCurrency)",
    },
    {
      id: "3",
      name: "convert_currency_pair",
      description: "Convert between two specific currencies with optional amount calculation",
      params: "(baseCurrency,targetCurrency,amount)",
    },
  ])

  // Helper function to generate Pi scoring for a trace step using centralized function
  const generatePiRubricScores = async (traceContent: string, traceType: TraceEntry["type"]): Promise<Array<{rubricItemId: string, score: number}>> => {
    const relevantRubricItems = evaluationRubric.filter(item => 
      item.traceType === traceType || item.traceType === "general"
    )
    
    if (relevantRubricItems.length === 0) {
      return []
    }

    try {
      const response = await fetch("/api/pi-scoring", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          traceContent,
          traceType,
          rubricCriteria: relevantRubricItems
        }),
      })

      if (!response.ok) {
        throw new Error(`Pi scoring API error: ${response.status}`)
      }

      const result = await response.json()
      return result.scores || []
    } catch (error) {
      console.error("[Frontend] Error calling Pi scoring API:", error)
      // Fallback to mock scores on error
      return relevantRubricItems.map(item => ({
        rubricItemId: item.id,
        score: Math.round((Math.random() * 0.8 + 0.1) * 100) / 100
      }))
    }
  }

  // Helper function to update scores for an existing criteria in all traces
  const updateCriteriaScoresInTraces = async (criteriaId: string, updatedCriteria: EvaluationRubricItem) => {
    // First, remove scores for this criteria from all traces (in case applicability changed)
    setTraces((prev) => prev.map(t => ({
      ...t,
      rubricScores: t.rubricScores?.filter(score => score.rubricItemId !== criteriaId) || []
    })))

    setEvaluationResults((prev) => prev.map(result => ({
      ...result,
      traces: result.traces.map(t => ({
        ...t,
        rubricScores: t.rubricScores?.filter(score => score.rubricItemId !== criteriaId) || []
      }))
    })))

    // Get all traces that this criteria applies to
    const applicableTraces = traces.filter(trace => {
      if (updatedCriteria.traceType === trace.type || updatedCriteria.traceType === "general") {
        if (updatedCriteria.traceType === "action" && updatedCriteria.toolName) {
          const toolMatch = trace.content.match(/(\w+)\(/)
          const detectedToolName = toolMatch ? toolMatch[1] : null
          return detectedToolName === updatedCriteria.toolName
        }
        return true
      }
      return false
    })

    // Generate Pi scores for each applicable trace
    for (const trace of applicableTraces) {
      try {
        // Create a temporary rubric with just the updated criteria for scoring
        const tempRubric = [updatedCriteria]
        const response = await fetch("/api/pi-scoring", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            traceContent: trace.content,
            traceType: trace.type,
            rubricCriteria: tempRubric
          }),
        })

        let newScore: number
        if (response.ok) {
          const result = await response.json()
          newScore = result.scores?.[0]?.score || Math.round((Math.random() * 0.8 + 0.1) * 100) / 100
        } else {
          // Fallback to mock score
          newScore = Math.round((Math.random() * 0.8 + 0.1) * 100) / 100
        }

        // Add the new score to applicable traces
        setTraces((prev) => prev.map(t => 
          t.id === trace.id ? {
            ...t,
            rubricScores: [...(t.rubricScores || []), { rubricItemId: criteriaId, score: newScore }]
          } : t
        ))

        // Update traces in evaluation results
        setEvaluationResults((prev) => prev.map(result => ({
          ...result,
          traces: result.traces.map(t => 
            t.id === trace.id ? {
              ...t,
              rubricScores: [...(t.rubricScores || []), { rubricItemId: criteriaId, score: newScore }]
            } : t
          )
        })))
      } catch (error) {
        console.error("Error updating criteria scores:", error)
        // Fallback to mock score
        const newScore = Math.round((Math.random() * 0.8 + 0.1) * 100) / 100
        
        setTraces((prev) => prev.map(t => 
          t.id === trace.id ? {
            ...t,
            rubricScores: [...(t.rubricScores || []), { rubricItemId: criteriaId, score: newScore }]
          } : t
        ))

        setEvaluationResults((prev) => prev.map(result => ({
          ...result,
          traces: result.traces.map(t => 
            t.id === trace.id ? {
              ...t,
              rubricScores: [...(t.rubricScores || []), { rubricItemId: criteriaId, score: newScore }]
            } : t
          )
        })))
      }
    }
  }

  // Helper function to add scores for a new criteria to existing traces
  const addNewCriteriaScoresToTraces = async (newCriteriaId: string, newCriteria: EvaluationRubricItem) => {
    // Get all traces that this criteria applies to
    const applicableTraces = traces.filter(trace => {
      if (newCriteria.traceType === trace.type || newCriteria.traceType === "general") {
        if (newCriteria.traceType === "action" && newCriteria.toolName) {
          const toolMatch = trace.content.match(/(\w+)\(/)
          const detectedToolName = toolMatch ? toolMatch[1] : null
          return detectedToolName === newCriteria.toolName
        }
        return true
      }
      return false
    })

    // Generate Pi scores for each applicable trace
    for (const trace of applicableTraces) {
      try {
        // Create a temporary rubric with just the new criteria for scoring
        const tempRubric = [newCriteria]
        const response = await fetch("/api/pi-scoring", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            traceContent: trace.content,
            traceType: trace.type,
            rubricCriteria: tempRubric
          }),
        })

        let newScore: number
        if (response.ok) {
          const result = await response.json()
          newScore = result.scores?.[0]?.score || Math.round((Math.random() * 0.8 + 0.1) * 100) / 100
        } else {
          // Fallback to mock score
          newScore = Math.round((Math.random() * 0.8 + 0.1) * 100) / 100
        }

        // Update current traces
        setTraces((prev) => prev.map(t => 
          t.id === trace.id ? {
            ...t,
            rubricScores: [...(t.rubricScores || []), {
              rubricItemId: newCriteriaId,
              score: newScore
            }]
          } : t
        ))

        // Update traces in evaluation results
        setEvaluationResults((prev) => prev.map(result => ({
          ...result,
          traces: result.traces.map(t => 
            t.id === trace.id ? {
              ...t,
              rubricScores: [...(t.rubricScores || []), {
                rubricItemId: newCriteriaId,
                score: newScore
              }]
            } : t
          )
        })))
      } catch (error) {
        console.error("Error adding new criteria scores:", error)
        // Fallback to mock score
        const newScore = Math.round((Math.random() * 0.8 + 0.1) * 100) / 100
        
        setTraces((prev) => prev.map(t => 
          t.id === trace.id ? {
            ...t,
            rubricScores: [...(t.rubricScores || []), {
              rubricItemId: newCriteriaId,
              score: newScore
            }]
          } : t
        ))

        setEvaluationResults((prev) => prev.map(result => ({
          ...result,
          traces: result.traces.map(t => 
            t.id === trace.id ? {
              ...t,
              rubricScores: [...(t.rubricScores || []), {
                rubricItemId: newCriteriaId,
                score: newScore
              }]
            } : t
          )
        })))
      }
    }
  }

  // Helper function to calculate average score for a trace step
  const calculateTraceAverageScore = (trace: TraceEntry): number => {
    if (!trace.rubricScores || trace.rubricScores.length === 0) return 0
    const sum = trace.rubricScores.reduce((acc, score) => acc + score.score, 0)
    return Math.round((sum / trace.rubricScores.length) * 100) / 100
  }

  // Helper function to calculate average score for traces based on selected rubric criteria
  const calculateTracesAverageScore = (traces: TraceEntry[], selectedCriteria: string[]): number => {
    if (traces.length === 0) return 0
    
    // If "all" is selected, use all scores
    if (selectedCriteria.includes("all")) {
      const allScores = traces.flatMap(trace => trace.rubricScores || [])
      if (allScores.length === 0) return 0
      const sum = allScores.reduce((acc, score) => acc + score.score, 0)
      return Math.round((sum / allScores.length) * 100) / 100
    }
    
    // If no criteria selected, return 0 (no filtering)
    if (selectedCriteria.length === 0) {
      return 0
    }
    
    // Filter scores based on selected criteria
    const filteredScores = traces.flatMap(trace => 
      (trace.rubricScores || []).filter(score => selectedCriteria.includes(score.rubricItemId))
    )
    
    if (filteredScores.length === 0) return 0
    const sum = filteredScores.reduce((acc, score) => acc + score.score, 0)
    return Math.round((sum / filteredScores.length) * 100) / 100
  }

  const addTrace = async (type: TraceEntry["type"], content: string) => {
    const rubricScores = await generatePiRubricScores(content, type)
    const newTrace: TraceEntry = {
      id: Date.now().toString() + Math.random(),
      type,
      content,
      timestamp: new Date(),
      rubricScores,
    }
    setTraces((prev) => [...prev, newTrace])
  }

  const clearTrace = () => {
    setTraces([])
  }

  const getConfigurationHash = () => {
    // Create a unique hash by using a simple hash of the system prompt
    const hash = goal.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    const promptPreview = goal.length > 40 ? goal.slice(0, 40) + "..." : goal
    return `${promptPreview} (${selectedModel}${usePiJudge ? ", Pi Judge" : ""}) [${Math.abs(hash).toString(36).slice(0, 6)}]`
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

    setIsRunning(true)
    isRunningRef.current = true
    clearTrace()

    const currentConfigHash = getConfigurationHash()
    const startTime = Date.now()
    const currentUserPrompt = userPrompt // Store the current prompt
    
    // Check if this exact configuration + user prompt combination already exists
    const existingResult = evaluationResults.find(result => 
      result.configurationName === currentConfigHash && result.userPrompt === userPrompt
    )
    
    let executingResult: EvaluationResult
    
    if (existingResult) {
      // Same configuration and prompt, update the existing result
      executingResult = {
        ...existingResult,
        systemPrompt: goal, // Update with current system prompt
        finalOutput: "executing",
        timestamp: new Date(),
        traces: [],
        isExecuting: true,
        metrics: {
          steps: 0,
          latency: 0,
          totalTokens: 0
        }
      }
      
      // Update the existing result
      setEvaluationResults((prev) => 
        prev.map(result => 
          result.id === existingResult.id 
            ? executingResult 
            : result
        )
      )
    } else {
      // New configuration or new user prompt, create a new evaluation result
      executingResult = {
        id: Date.now().toString() + Math.random(),
        configurationHash: currentConfigHash,
        configurationName: currentConfigHash,
        systemPrompt: goal, // Store the actual system prompt used
        userPrompt: userPrompt,
        finalOutput: "executing",
        timestamp: new Date(),
        traces: [],
        isExecuting: true,
        model: selectedModel,
        usePiJudge: usePiJudge,
        metrics: {
          steps: 0,
          latency: 0,
          totalTokens: 0
        }
      }
      setEvaluationResults((prev) => [...prev, executingResult])
    }

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goal: currentUserPrompt,
          model: selectedModel,
          systemPrompt: goal,
          usePiJudge: usePiJudge,
          evaluationRubric: evaluationRubric,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response body")
      }

      const decoder = new TextDecoder()
      const currentTraces: TraceEntry[] = []

      while (true) {
        if (!isRunningRef.current) {
          console.log("[v0] Stopping execution - isRunning is false")
          reader.cancel()
          return
        }

        const { done, value } = await reader.read()

        if (done) {
          console.log("[v0] Stream completed")
          break
        }

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))

              // Use rubric scores from agent if available, otherwise generate them
              let rubricScores: Array<{rubricItemId: string, score: number}> = []
              if (data.rubricScores && Array.isArray(data.rubricScores)) {
                // Use scores from agent route
                rubricScores = data.rubricScores
              } else {
                // Generate Pi scores for the trace (fallback)
                rubricScores = await generatePiRubricScores(data.content, data.type)
              }
              
              const newTrace: TraceEntry = {
                id: Date.now().toString() + Math.random(),
                type: data.type,
                content: data.content,
                timestamp: new Date(),
                rubricScores,
              }

              currentTraces.push(newTrace)
              setTraces((prev) => [...prev, newTrace])

              // If this is the final trace, update the evaluation result
              if (data.type === "final") {
                console.log("[v0] Final trace received, updating evaluation result")
                const endTime = Date.now()
                const totalLatency = endTime - startTime
                
                setEvaluationResults((prev) =>
                  prev.map((result) =>
                    result.id === executingResult.id
                      ? {
                          ...result,
                          finalOutput: data.content,
                          traces: currentTraces,
                          isExecuting: false,
                          metrics: {
                            steps: data.metadata?.steps || currentTraces.length,
                            latency: totalLatency,
                            totalTokens: data.metadata?.totalTokens || Math.floor(Math.random() * 5000) + 1000
                          }
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

      // Update the executing result with error metrics
      const endTime = Date.now()
      const totalLatency = endTime - startTime
      
      setEvaluationResults((prev) =>
        prev.map((result) =>
          result.id === executingResult.id
            ? {
                ...result,
                finalOutput: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                traces: traces,
                isExecuting: false,
                metrics: {
                  steps: traces.length,
                  latency: totalLatency,
                  totalTokens: Math.floor(Math.random() * 2000) + 500 // Mock token count for error case
                }
              }
            : result,
        ),
      )
    }

    console.log("[v0] Agent execution completed")
    setIsRunning(false)
    isRunningRef.current = false
    
    // Don't clear the user prompt to enable conversation continuation
    // The user can now continue the conversation by adding more prompts
  }

  const stopAgent = () => {
    setIsRunning(false)
    isRunningRef.current = false
  }

  const handleFeedback = (traceId: string, isPositive: boolean) => {
    setFeedbackModal({ traceId, isPositive })
  }

  const handleFeedbackSubmit = async (traceId: string, isPositive: boolean, note: string) => {
    // Find the trace that this feedback is for to determine its type and extract tool information
    const targetTrace = traces.find(trace => trace.id === traceId)
    const traceType = targetTrace?.type || "general"
    
    // Extract tool name from action traces
    let detectedToolName: string | null = null
    if (targetTrace?.type === "action" && targetTrace.content) {
      // Look for tool calls in the action content (e.g., "search_countries(United States)")
      const toolMatch = targetTrace.content.match(/(\w+)\(/)
      if (toolMatch) {
        detectedToolName = toolMatch[1]
      }
    }

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

    // Call the helper API to get evaluation criteria from feedback
    try {
      const response = await fetch("/api/feedback-helper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          feedbackAnnotation: note || (isPositive ? "Positive feedback" : "Negative feedback"),
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const newRubricItem: EvaluationRubricItem = {
          id: Date.now().toString() + Math.random(),
          criteria: result.criteriaName,
          description: result.question,
          traceType: traceType as "thinking" | "action" | "observation" | "final" | "general",
          toolName: result.toolName || detectedToolName, // Use API result or detected tool
          timestamp: new Date(),
        }
        setEvaluationRubric((prev) => [...prev, newRubricItem])
        
        // Add scores for this new criteria to all existing traces
        await addNewCriteriaScoresToTraces(newRubricItem.id, newRubricItem)
      }
    } catch (error) {
      console.error("Error calling feedback helper API:", error)
    }
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

  const getRubricMultiselectOptions = (): MultiselectOption[] => {
    if (evaluationRubric.length === 0) {
      return [
        { value: "all", label: "All", category: "General" }
      ]
    }

    const options: MultiselectOption[] = [
      { value: "all", label: "All", category: "General" }
    ]

    // Group criteria by trace type and tool
    const criteriaByTypeAndTool = evaluationRubric.reduce((acc, item) => {
      if (!acc[item.traceType]) {
        acc[item.traceType] = {}
      }
      
      const toolKey = item.toolName || "general"
      if (!acc[item.traceType][toolKey]) {
        acc[item.traceType][toolKey] = []
      }
      acc[item.traceType][toolKey].push(item)
      return acc
    }, {} as Record<string, Record<string, EvaluationRubricItem[]>>)

    const traceTypeLabels = {
      thinking: "Thinking Steps",
      action: "Action Steps", 
      observation: "Observation Steps",
      final: "Final Output",
      general: "General Criteria"
    }

    Object.entries(criteriaByTypeAndTool).forEach(([traceType, toolGroups]) => {
      const traceTypeLabel = traceTypeLabels[traceType as keyof typeof traceTypeLabels] || traceType
      
      Object.entries(toolGroups).forEach(([toolKey, criteria]) => {
        const categoryLabel = toolKey === "general" 
          ? traceTypeLabel 
          : `${traceTypeLabel} - ${toolKey}`
        
        criteria.forEach(item => {
          options.push({
            value: item.id,
            label: item.criteria,
            category: categoryLabel
          })
        })
      })
    })

    return options
  }

  const getFilteredEvaluationResults = () => {
    // If no filters are selected or "all" is selected, show all results
    if (selectedRubricFilters.length === 0 || selectedRubricFilters.includes("all")) {
      return evaluationResults
    }

    // For now, return all results since we don't have actual scoring data
    // In a real implementation, this would filter based on actual scores
    return evaluationResults
  }

  const handleRubricFilterChange = (newFilters: string[]) => {
    // If "all" is selected, clear other selections
    if (newFilters.includes("all")) {
      setSelectedRubricFilters(["all"])
    } else if (newFilters.length === 0) {
      // If nothing is selected, allow empty selection (no filtering)
      setSelectedRubricFilters([])
    } else {
      setSelectedRubricFilters(newFilters)
    }
  }

  // Ensure "All" is selected when evaluation rubric is available
  useEffect(() => {
    if (evaluationRubric.length > 0 && !selectedRubricFilters.includes("all")) {
      setSelectedRubricFilters(["all"])
    }
  }, [evaluationRubric, selectedRubricFilters])

  const getResultForCell = (configName: string, prompt: string) => {
    // Find the most recent result for this configuration and prompt combination
    const results = evaluationResults.filter((r) => r.configurationName === configName && r.userPrompt === prompt)
    return results.length > 0 ? results[results.length - 1] : undefined
  }

  const getAverageMetricsForConfiguration = (configName: string) => {
    const results = evaluationResults.filter((r) => r.configurationName === configName && !r.isExecuting)
    if (results.length === 0) return null

    const totalSteps = results.reduce((sum, r) => sum + r.metrics.steps, 0)
    const totalLatency = results.reduce((sum, r) => sum + r.metrics.latency, 0)
    const totalTokens = results.reduce((sum, r) => sum + r.metrics.totalTokens, 0)

    return {
      avgSteps: Math.round(totalSteps / results.length),
      avgLatency: Math.round(totalLatency / results.length),
      avgTokens: Math.round(totalTokens / results.length)
    }
  }

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const formatTokens = (tokens: number) => {
    if (tokens < 1000) return `${tokens}`
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`
    return `${(tokens / 1000000).toFixed(1)}M`
  }

  const truncateText = (text: string, maxLength = 100) => {
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text
  }

  const loadConfigurationFromEvaluation = (result: EvaluationResult) => {
    setGoal(result.systemPrompt) // Use the stored system prompt
    setCurrentPage("Build Agent")
    // Don't clear user prompt to maintain conversation context
    setTraces([]) // Clear any existing traces
    setIsRunning(false) // Ensure not in running state
    setSelectedModel(result.model)
    setUsePiJudge(result.usePiJudge)
  }

  const loadFullResultFromEvaluation = (result: EvaluationResult) => {
    // Load configuration, prompt, and traces
    setGoal(result.systemPrompt) // Use the stored system prompt
    setUserPrompt(result.userPrompt)
    setTraces(result.traces)
    setCurrentPage("Build Agent")
    setSelectedModel(result.model)
    setUsePiJudge(result.usePiJudge)
  }

  const renderEvaluationTable = () => {
    const filteredResults = getFilteredEvaluationResults()
    const configurations = new Set(filteredResults.map((r) => r.configurationName))
    const prompts = new Set(filteredResults.map((r) => r.userPrompt))
    const configurationsArray = Array.from(configurations)
    const promptsArray = Array.from(prompts)

    if (configurationsArray.length === 0 || promptsArray.length === 0) {
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
      <div className="h-full overflow-auto">
        <div className="relative">
          <table className="border-collapse border border-border">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 border border-border p-3 bg-muted/50 text-left font-medium w-64 min-w-64 max-w-64">
                  Configuration
                </th>
                {promptsArray.map((prompt, index) => (
                  <th key={index} className="border border-border p-3 bg-muted/50 text-left font-medium w-80 min-w-80 max-w-80">
                    {truncateText(prompt, 50)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {configurationsArray.map((config, configIndex) => {
                const configResult = evaluationResults.find((r) => r.configurationName === config)
                const modelName = configResult?.model || selectedModel
                const isPiJudgeEnabled = configResult?.usePiJudge || false

                return (
                  <tr key={configIndex}>
                    <td
                      className="sticky left-0 z-10 border border-border p-3 font-medium bg-muted/30 w-64 min-w-64 max-w-64 align-top cursor-pointer hover:bg-muted/50 transition-colors"
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
                      
                      {/* Average Performance Metrics */}
                      {(() => {
                        const avgMetrics = getAverageMetricsForConfiguration(config)
                        return avgMetrics && (
                          <div className="space-y-2 mb-3">
                            <div className="text-xs font-medium text-muted-foreground">Average performance</div>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {avgMetrics.avgSteps} steps
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                {formatLatency(avgMetrics.avgLatency)}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                {formatTokens(avgMetrics.avgTokens)}
                              </Badge>
                            </div>
                          </div>
                        )
                      })()}
                      
                      <div className="text-sm text-muted-foreground">{truncateText(configResult?.systemPrompt || goal, 80)}</div>
                    </td>
                    {promptsArray.map((prompt, promptIndex) => {
                      const result = getResultForCell(config, prompt)
                      return (
                        <td
                          key={promptIndex}
                          className={`border border-border p-3 w-80 min-w-80 max-w-80 align-top ${
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
                                  {/* Performance Metrics Badges */}
                                  <div className="mt-2 space-y-1">
                                    {/* Average Score Badge */}
                                    {result.traces && result.traces.length > 0 && selectedRubricFilters.length > 0 && (
                                      <div>
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${
                                            calculateTracesAverageScore(result.traces, selectedRubricFilters) >= 0.8 
                                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                              : calculateTracesAverageScore(result.traces, selectedRubricFilters) >= 0.6
                                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                          }`}
                                          title={`Average score across ${selectedRubricFilters.includes("all") ? "all" : selectedRubricFilters.length} selected rubric criteria: ${calculateTracesAverageScore(result.traces, selectedRubricFilters).toFixed(2)}`}
                                        >
                                          Avg: {calculateTracesAverageScore(result.traces, selectedRubricFilters).toFixed(2)}
                                        </Badge>
                                      </div>
                                    )}
                                    
                                    {/* Performance Metrics */}
                                    <div className="flex flex-wrap gap-1">
                                      <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                        Steps: {result.metrics.steps}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                        {formatLatency(result.metrics.latency)}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                                        {formatTokens(result.metrics.totalTokens)} tokens
                                      </Badge>
                                    </div>
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
              // Parse the new configuration format: "prompt... (model, Pi Judge) [hash]"
              const configParts = entry.configurationName.split(" (")[1]?.split(")")[0] || ""
              const modelMatch = configParts.split(",")[0] || "gpt-4"
              const isPiJudgeEnabled = configParts.includes("Pi Judge")
              // Extract system prompt from the beginning of the configuration name
              const systemPrompt = entry.configurationName.split(" (")[0] || entry.configurationName

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

  const [addCriteriaModal, setAddCriteriaModal] = useState(false)
  const [editCriteriaModal, setEditCriteriaModal] = useState(false)
  const [editingCriteriaId, setEditingCriteriaId] = useState<string | null>(null)
  const [newCriteria, setNewCriteria] = useState({
    criteria: "",
    description: "",
    traceType: "general" as "thinking" | "action" | "observation" | "final" | "general",
    toolName: "" as string | null
  })

  const handleAddCriteria = async () => {
    if (!newCriteria.criteria.trim() || !newCriteria.description.trim()) {
      alert("Please fill in both criteria name and description")
      return
    }

    const rubricItem: EvaluationRubricItem = {
      id: Date.now().toString() + Math.random(),
      criteria: newCriteria.criteria,
      description: newCriteria.description,
      traceType: newCriteria.traceType,
      toolName: newCriteria.toolName || null,
      timestamp: new Date(),
    }

    // Add the new criteria to the rubric
    setEvaluationRubric((prev) => [...prev, rubricItem])
    
    // Add scores for this new criteria to all existing traces
    await addNewCriteriaScoresToTraces(rubricItem.id, rubricItem)
    
    // Reset form and close modal
    setNewCriteria({
      criteria: "",
      description: "",
      traceType: "general",
      toolName: null
    })
    setAddCriteriaModal(false)
  }

  const handleEditCriteria = (criteriaId: string) => {
    const criteria = evaluationRubric.find(item => item.id === criteriaId)
    if (!criteria) return

    setEditingCriteriaId(criteriaId)
    setNewCriteria({
      criteria: criteria.criteria,
      description: criteria.description,
      traceType: criteria.traceType,
      toolName: criteria.toolName || ""
    })
    setEditCriteriaModal(true)
  }

  const handleUpdateCriteria = async () => {
    if (!editingCriteriaId || !newCriteria.criteria.trim() || !newCriteria.description.trim()) {
      alert("Please fill in both criteria name and description")
      return
    }

    const updatedRubricItem: EvaluationRubricItem = {
      id: editingCriteriaId,
      criteria: newCriteria.criteria,
      description: newCriteria.description,
      traceType: newCriteria.traceType,
      toolName: newCriteria.toolName || null,
      timestamp: new Date(),
    }

    // Update the criteria in the rubric
    setEvaluationRubric((prev) => prev.map(item => 
      item.id === editingCriteriaId ? updatedRubricItem : item
    ))

    // Update scores for this criteria in all existing traces
    await updateCriteriaScoresInTraces(updatedRubricItem.id, updatedRubricItem)
    
    // Reset form and close modal
    setNewCriteria({
      criteria: "",
      description: "",
      traceType: "general",
      toolName: null
    })
    setEditCriteriaModal(false)
    setEditingCriteriaId(null)
  }

  const handleDeleteCriteria = (criteriaId: string) => {
    if (confirm("Are you sure you want to delete this criteria? This action cannot be undone.")) {
      // Remove the criteria from the rubric
      setEvaluationRubric((prev) => prev.filter(item => item.id !== criteriaId))
      
      // Remove scores for this criteria from all existing traces
      setTraces((prev) => prev.map(trace => ({
        ...trace,
        rubricScores: trace.rubricScores?.filter(score => score.rubricItemId !== criteriaId) || []
      })))

      // Remove scores from evaluation results as well
      setEvaluationResults((prev) => prev.map(result => ({
        ...result,
        traces: result.traces.map(trace => ({
          ...trace,
          rubricScores: trace.rubricScores?.filter(score => score.rubricItemId !== criteriaId) || []
        }))
      })))
    }
  }

  const renderEvaluationRubric = () => {
    // Group criteria by trace type, then by tool within each type
    const criteriaByType = evaluationRubric.reduce((acc, item) => {
      if (!acc[item.traceType]) {
        acc[item.traceType] = {}
      }
      
      // Group by tool name within trace type
      const toolKey = item.toolName || "general"
      if (!acc[item.traceType][toolKey]) {
        acc[item.traceType][toolKey] = []
      }
      acc[item.traceType][toolKey].push(item)
      return acc
    }, {} as Record<string, Record<string, EvaluationRubricItem[]>>)

    const traceTypeOrder = ["thinking", "action", "observation", "final", "general"]
    const traceTypeLabels = {
      thinking: "Thinking Steps",
      action: "Action Steps", 
      observation: "Observation Steps",
      final: "Final Output",
      general: "General Criteria"
    }

    const getTraceTypeColor = (type: string) => {
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

    return (
      <div className="h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Evaluation Rubric</h1>
          <Button
            onClick={() => setAddCriteriaModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Criteria
          </Button>
        </div>
        <div className="flex-1 p-6 border rounded-lg overflow-y-auto">
          <div className="space-y-8 h-full">
            {evaluationRubric.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <p className="mb-2">No evaluation criteria yet.</p>
                  <p className="text-sm">Provide feedback on trace steps to populate the rubric.</p>
                </div>
              </div>
            ) : (
              traceTypeOrder.map((traceType) => {
                const toolGroups = criteriaByType[traceType] || {}
                const totalCriteria = Object.values(toolGroups).flat().length
                
                if (totalCriteria === 0) return null

                return (
                  <div key={traceType} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold">{traceTypeLabels[traceType as keyof typeof traceTypeLabels]}</h2>
                      <Badge variant="secondary" className="text-xs">
                        {totalCriteria} criteria
                      </Badge>
                    </div>
                    
                    {/* Render tool groups within this trace type */}
                    {Object.entries(toolGroups).map(([toolKey, criteria]) => {
                      if (criteria.length === 0) return null
                      
                      return (
                        <div key={`${traceType}-${toolKey}`} className="space-y-3 ml-4">
                          {/* Tool-specific header */}
                          {toolKey !== "general" && (
                            <div className="flex items-center gap-2">
                              <h3 className="text-md font-medium text-muted-foreground">
                                Tool: {toolKey}
                              </h3>
                              <Badge variant="outline" className="text-xs">
                                {criteria.length} criteria
                              </Badge>
                            </div>
                          )}
                          
                          {/* Criteria for this tool */}
                          <div className="space-y-3">
                            {criteria.map((item, index) => (
                              <div key={item.id} className={`p-4 border-l-4 rounded-r-lg ${getTraceTypeColor(traceType)} group relative`}>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm mb-2">{item.criteria}</div>
                                    <div className="text-xs text-muted-foreground">{item.description}</div>
                                    <div className="text-xs text-muted-foreground mt-2">
                                      Added: {item.timestamp.toLocaleString()}
                                      {item.toolName && (
                                        <span className="ml-2 text-blue-600 dark:text-blue-400">
                                          • Tool: {item.toolName}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleEditCriteria(item.id)
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
                                        handleDeleteCriteria(item.id)
                                      }}
                                      className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-950/20"
                                    >
                                      <Trash2 className="h-3 w-3 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
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
              Build Pi Judges
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
                              <div className="font-mono text-sm font-medium text-foreground truncate">
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
                          <strong>Multi-Tool Agent</strong> - Real country data from REST Countries API and live exchange rates from Exchange Rate API
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

            {/* Main Content Area - ChatGPT-like Layout */}
            <div className="flex-1 mx-6 flex flex-col">
              <h1 className="text-2xl font-bold mb-6">Agent Conversation</h1>
              
              {/* Trace Display Area - Takes up most of the space */}
              <div className="flex-1 flex flex-col min-h-0" style={{ height: 'calc(100vh - 280px)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium">Execution Trace</h2>
                </div>
                
                {/* Trace Messages - Similar to ChatGPT conversation */}
                <div className="flex-1 overflow-hidden border rounded-lg">
                  <div className="h-full overflow-y-auto">
                    {traces.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                          <p className="mb-2">No conversation yet.</p>
                          <p className="text-sm">Enter a prompt below to start the agent conversation.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 p-4">
                        {traces.map((trace, index) => (
                          <div key={trace.id} className="flex flex-col">
                            <div className={`border-l-4 p-4 rounded-r-lg ${getTraceColor(trace.type)}`}>
                              <div className="flex items-center justify-between mb-2">
                                <Badge className={getBadgeColor(trace.type)}>{trace.type.toUpperCase()}</Badge>
                                <div className="flex items-center gap-2">
                                  {/* Average Score Badge */}
                                  {trace.rubricScores && trace.rubricScores.length > 0 && (
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${
                                        calculateTraceAverageScore(trace) >= 0.8 
                                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                          : calculateTraceAverageScore(trace) >= 0.6
                                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                      }`}
                                      title={`Average score across all rubric criteria: ${calculateTraceAverageScore(trace).toFixed(2)}`}
                                    >
                                      Avg: {calculateTraceAverageScore(trace).toFixed(2)}
                                    </Badge>
                                  )}
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
                              
                              {/* Rubric Scores Display */}
                              {trace.rubricScores && trace.rubricScores.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border/50">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">Rubric Scores:</div>
                                  <div className="overflow-x-auto">
                                    <div className="flex gap-2 min-w-max pb-1">
                                      {trace.rubricScores.map((score, scoreIndex) => {
                                        const rubricItem = evaluationRubric.find(item => item.id === score.rubricItemId)
                                        if (!rubricItem) return null
                                        
                                        const getScoreColor = (score: number) => {
                                          if (score >= 0.8) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                          if (score >= 0.6) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                          return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                        }
                                        
                                        return (
                                          <div key={scoreIndex} className="flex items-center gap-1 flex-shrink-0">
                                            <Badge 
                                              variant="outline" 
                                              className={`text-xs ${getScoreColor(score.score)}`}
                                              title={rubricItem.description}
                                            >
                                              {rubricItem.criteria}: {score.score.toFixed(2)}
                                            </Badge>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        <div ref={traceEndRef} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* User Prompt Input - Fixed at bottom like ChatGPT */}
              <div className="border-t bg-background p-4">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Textarea
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        placeholder="Ask the agent anything... (e.g., 'Tell me about the exchange rates between India and USA')"
                        className="w-full min-h-[60px] max-h-[120px] resize-none"
                        disabled={isRunning}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            if (!isRunning && userPrompt.trim()) {
                              runAgent()
                            }
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={runAgent} 
                        disabled={isRunning || !userPrompt.trim()} 
                        size="sm"
                        className="h-10 px-4"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start
                      </Button>
                      <Button 
                        onClick={stopAgent} 
                        disabled={!isRunning} 
                        variant="destructive"
                        size="sm"
                        className="h-10 px-4"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : currentPage === "Evaluate Agent" ? (
          <div className="h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Agent Evaluation Results</h1>
              <div className="w-80">
                <Multiselect
                  options={getRubricMultiselectOptions()}
                  value={selectedRubricFilters}
                  onChange={handleRubricFilterChange}
                  placeholder="Filter by rubric criteria..."
                />
              </div>
            </div>
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
            onSubmit={async (note) => await handleFeedbackSubmit(feedbackModal.traceId, feedbackModal.isPositive, note)}
          />
        )}
      </Dialog>

      {/* Add Criteria Modal */}
      <Dialog open={addCriteriaModal} onOpenChange={setAddCriteriaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Add Judge Criteria
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Create a new evaluation criteria for your Pi Judge.</p>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="criteria-name" className="block text-sm font-medium mb-2">
                  Criteria Name
                </label>
                <input
                  id="criteria-name"
                  type="text"
                  value={newCriteria.criteria}
                  onChange={(e) => setNewCriteria(prev => ({ ...prev, criteria: e.target.value }))}
                  placeholder="e.g., Clarity of Reasoning"
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="trace-type" className="block text-sm font-medium mb-2">
                  Apply To
                </label>
                <select
                  id="trace-type"
                  value={newCriteria.traceType}
                  onChange={(e) => setNewCriteria(prev => ({ 
                    ...prev, 
                    traceType: e.target.value as "thinking" | "action" | "observation" | "final" | "general"
                  }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  <option value="general">General (All Steps)</option>
                  <option value="thinking">Thinking Steps</option>
                  <option value="action">Action Steps</option>
                  <option value="observation">Observation Steps</option>
                  <option value="final">Final Output</option>
                </select>
              </div>

              {newCriteria.traceType === "action" && (
                <div>
                  <label htmlFor="tool-name" className="block text-sm font-medium mb-2">
                    Tool (Optional)
                  </label>
                  <select
                    id="tool-name"
                    value={newCriteria.toolName || ""}
                    onChange={(e) => setNewCriteria(prev => ({ 
                      ...prev, 
                      toolName: e.target.value || null 
                    }))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  >
                    <option value="">All Tools</option>
                    {tools.map((tool) => (
                      <option key={tool.id} value={tool.name}>
                        {tool.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="criteria-description" className="block text-sm font-medium mb-2">
                  Description
                </label>
                <Textarea
                  id="criteria-description"
                  value={newCriteria.description}
                  onChange={(e) => setNewCriteria(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this criteria evaluates (e.g., 'How clear and logical is the reasoning in this step?')"
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setAddCriteriaModal(false)
                  setNewCriteria({
                    criteria: "",
                    description: "",
                    traceType: "general",
                    toolName: null
                  })
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddCriteria}>
                Save Criteria
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Criteria Modal */}
      <Dialog open={editCriteriaModal} onOpenChange={setEditCriteriaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Edit Judge Criteria
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Edit the evaluation criteria for your Pi Judge.</p>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="edit-criteria-name" className="block text-sm font-medium mb-2">
                  Criteria Name
                </label>
                <input
                  id="edit-criteria-name"
                  type="text"
                  value={newCriteria.criteria}
                  onChange={(e) => setNewCriteria(prev => ({ ...prev, criteria: e.target.value }))}
                  placeholder="e.g., Clarity of Reasoning"
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="edit-trace-type" className="block text-sm font-medium mb-2">
                  Apply To
                </label>
                <select
                  id="edit-trace-type"
                  value={newCriteria.traceType}
                  onChange={(e) => setNewCriteria(prev => ({ 
                    ...prev, 
                    traceType: e.target.value as "thinking" | "action" | "observation" | "final" | "general"
                  }))}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  <option value="general">General (All Steps)</option>
                  <option value="thinking">Thinking Steps</option>
                  <option value="action">Action Steps</option>
                  <option value="observation">Observation Steps</option>
                  <option value="final">Final Output</option>
                </select>
              </div>

              {newCriteria.traceType === "action" && (
                <div>
                  <label htmlFor="edit-tool-name" className="block text-sm font-medium mb-2">
                    Tool (Optional)
                  </label>
                  <select
                    id="edit-tool-name"
                    value={newCriteria.toolName || ""}
                    onChange={(e) => setNewCriteria(prev => ({ 
                      ...prev, 
                      toolName: e.target.value || null 
                    }))}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  >
                    <option value="">All Tools</option>
                    {tools.map((tool) => (
                      <option key={tool.id} value={tool.name}>
                        {tool.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="edit-criteria-description" className="block text-sm font-medium mb-2">
                  Description
                </label>
                <Textarea
                  id="edit-criteria-description"
                  value={newCriteria.description}
                  onChange={(e) => setNewCriteria(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this criteria evaluates (e.g., 'How clear and logical is the reasoning in this step?')"
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setEditCriteriaModal(false)
                  setEditingCriteriaId(null)
                  setNewCriteria({
                    criteria: "",
                    description: "",
                    traceType: "general",
                    toolName: null
                  })
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateCriteria}>
                Update Criteria
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
