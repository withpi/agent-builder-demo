"use client"

import { useState, useMemo, useEffect } from "react"
import { useAgent } from "@/lib/agent-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Award, Clock, DollarSign, ListOrdered, Wrench, MessageSquare, Lightbulb } from "lucide-react"

// Helper function to get the final response from a trace
const getFinalResponse = (trace: any): string => {
  const responseStep = trace.steps.find((step: any) => step.type === "RESPONSE")
  return responseStep?.content || ""
}

// Helper function to truncate text with ellipsis
const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "..."
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type FilterType = "all" | "response" | "thinking" | "steps" | "latency" | "cost" | string // string for tool names like "tool:search"

export function EvaluateAgentPanel({
  onLoadConfigAndInput,
}: {
  onLoadConfigAndInput?: (configId: string, input: string, traceId?: string) => void
}) {
  const { traces, configs, rubrics, getUniqueToolNames } = useAgent()
  const [filter, setFilter] = useState<FilterType>("all")

  const toolNames = getUniqueToolNames()

  const filterOptions = useMemo(() => {
    const options: Array<{ value: FilterType; label: string }> = [{ value: "all", label: "Average of all scores" }]

    // Add Response option if response rubrics exist
    if (rubrics.some((r) => r.stepType === "RESPONSE")) {
      options.push({ value: "response", label: "Avg Response score" })
    }

    // Add Thinking option if thinking rubrics exist
    if (rubrics.some((r) => r.stepType === "THINKING")) {
      options.push({ value: "thinking", label: "Avg Thinking score" })
    }

    // Add tool-specific options
    toolNames.forEach((toolName) => {
      if (rubrics.some((r) => r.toolName === toolName)) {
        options.push({ value: `tool:${toolName}`, label: `Avg ${toolName} score` })
      }
    })

    // Add non-score sorting options
    options.push({ value: "steps", label: "Avg steps" })
    options.push({ value: "latency", label: "Avg latency" })
    options.push({ value: "cost", label: "Avg cost" })

    return options
  }, [rubrics, toolNames])

  const getFilterIcon = (filterType: FilterType) => {
    if (filterType === "all") return Award
    if (filterType === "response") return MessageSquare
    if (filterType === "thinking") return Lightbulb
    if (filterType === "steps") return ListOrdered
    if (filterType === "latency") return Clock
    if (filterType === "cost") return DollarSign
    if (filterType.startsWith("tool:")) return Wrench
    return Award // default
  }

  const tracesByConfigAndInput = traces.reduce(
    (acc, trace) => {
      const key = `${trace.configId}-${trace.input}`
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(trace)
      return acc
    },
    {} as Record<string, typeof traces>,
  )

  const uniqueInputs = Array.from(new Set(traces.map((t) => t.input)))


  const calculateTraceScore = (trace: (typeof traces)[0], filterType: FilterType = "all") => {
    let relevantSteps = trace.steps.filter((s) => s.score && !s.score.isLoading)

    // Apply filter
    if (filterType === "response") {
      relevantSteps = relevantSteps.filter((s) => s.type === "RESPONSE")
    } else if (filterType === "thinking") {
      relevantSteps = relevantSteps.filter((s) => s.type === "THINKING")
    } else if (filterType.startsWith("tool:")) {
      const toolName = filterType.substring(5)
      relevantSteps = relevantSteps.filter((s) => s.toolName === toolName)
    }
    // "all" means no filtering

    if (relevantSteps.length === 0) return null
    const totalScore = relevantSteps.reduce((sum, step) => sum + (step.score?.total || 0), 0)
    return Math.round((totalScore / relevantSteps.length) * 100)
  }

  const calculateLatency = (trace: (typeof traces)[0]) => {
    if (trace.steps.length === 0) return null
    const firstStep = trace.steps[0]
    const lastStep = trace.steps[trace.steps.length - 1]
    const latencyMs = lastStep.timestamp - firstStep.timestamp
    return latencyMs / 1000 // Convert to seconds
  }

  // Using rough estimates: gpt-4o ~$5/1M input tokens, ~$15/1M output tokens
  // gpt-4o-mini ~$0.15/1M input tokens, ~$0.60/1M output tokens
  const calculateCost = (trace: (typeof traces)[0]) => {
    const config = configs.find((c) => c.id === trace.configId)
    if (!config) return null

    // Rough token estimation: ~4 chars per token
    let totalInputTokens = 0
    let totalOutputTokens = 0

    trace.steps.forEach((step) => {
      if (step.type === "RESPONSE" || step.type === "THINKING") {
        totalOutputTokens += Math.ceil(step.content.length / 4)
      }
      if (step.type === "ACTION") {
        totalOutputTokens += Math.ceil(JSON.stringify(step.toolInput || {}).length / 4)
      }
      if (step.type === "OBSERVATION") {
        totalInputTokens += Math.ceil(JSON.stringify(step.toolOutput || {}).length / 4)
      }
    })

    // Add system prompt and user input to input tokens
    totalInputTokens += Math.ceil((config.systemPrompt.length + trace.input.length) / 4)

    // Calculate cost based on model
    let cost = 0
    if (config.model === "gpt-4o") {
      cost = (totalInputTokens / 1_000_000) * 5 + (totalOutputTokens / 1_000_000) * 15
    } else if (config.model === "gpt-4o-mini") {
      cost = (totalInputTokens / 1_000_000) * 0.15 + (totalOutputTokens / 1_000_000) * 0.6
    }

    return cost
  }

  const calculateConfigAverages = (configId: string, inputs: string[]) => {
    const configTraces = inputs
      .map((input) => {
        const key = `${configId}-${input}`
        const traces = tracesByConfigAndInput[key] || []
        return traces[traces.length - 1] // Get latest trace for each input
      })
      .filter(Boolean)

    if (configTraces.length === 0) return null

    const scores = configTraces.map((t) => calculateTraceScore(t, filter)).filter((s) => s !== null) as number[]
    const latencies = configTraces.map((t) => calculateLatency(t)).filter((l) => l !== null) as number[]
    const costs = configTraces.map((t) => calculateCost(t)).filter((c) => c !== null) as number[]
    const stepCounts = configTraces.map((t) => t.steps.length)

    return {
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      avgLatency: latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) : null,
      avgCost: costs.length > 0 ? (costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(4) : null,
      avgStepCount:
        stepCounts.length > 0 ? Math.round(stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length) : null,
    }
  }

  useEffect(() => {
    // This effect will re-run whenever rubrics change, causing the component to re-render
    // and display updated scores
  }, [rubrics])

  const FilterIcon = getFilterIcon(filter)

  return (
    <TooltipProvider>
      <div className="h-full overflow-y-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">Evaluate Agent</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-muted-foreground">Compare agent performance across different configurations and inputs</p>
      </div>

      {traces.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No traces available. Run the agent to generate traces.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px] sticky left-0 bg-background z-10">Configuration</TableHead>
                {uniqueInputs.map((input, idx) => (
                  <TableHead key={idx} className="min-w-[280px]">
                    {input.slice(0, 50)}
                    {input.length > 50 ? "..." : ""}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => {
                const configAverages = calculateConfigAverages(config.id, uniqueInputs)

                return (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium sticky left-0 bg-background z-10">
                      <div className="space-y-2">
                        <div>
                          <div className="font-semibold">{config.model}</div>
                          <div className="text-xs text-muted-foreground">{config.systemPrompt.slice(0, 40)}...</div>
                        </div>
                        <div className="space-y-1.5 pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <Badge variant={config.usePiJudge ? "default" : "secondary"} className="text-xs">
                              {config.usePiJudge ? "Guardrails ON" : "Guardrails OFF"}
                            </Badge>
                          </div>
                          {config.usePiJudge && config.rubricVersions && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Rubrics:</p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(config.rubricVersions).map(([rubricId, version]) => {
                                  const rubric = rubrics.find((r) => r.id === rubricId)
                                  if (!rubric) return null

                                  let label = ""
                                  if (rubric.rubricType === "response") {
                                    label = "Response"
                                  } else if (rubric.rubricType === "thinking") {
                                    label = "Thinking"
                                  } else if (rubric.toolName) {
                                    label = rubric.toolName.split(".").pop() || rubric.toolName
                                  }

                                  return (
                                    <Badge key={rubricId} variant="outline" className="text-xs px-1.5 py-0">
                                      {label} v{version}
                                    </Badge>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                          {config.toolSlugs && config.toolSlugs.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Wrench className="w-3 h-3" />
                                Apps:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {config.toolSlugs.map((slug, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                                    {slug}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {configAverages && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t">
                            {filter === "steps" && configAverages.avgStepCount !== null && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="default" className="gap-1 text-xs">
                                    <ListOrdered className="w-3 h-3" />
                                    {configAverages.avgStepCount} steps
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Average # of Steps: {configAverages.avgStepCount}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {filter === "latency" && configAverages.avgLatency !== null && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="default" className="gap-1 text-xs">
                                    <Clock className="w-3 h-3" />
                                    {configAverages.avgLatency}s
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Average Latency: {configAverages.avgLatency}s</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {filter === "cost" && configAverages.avgCost !== null && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="default" className="gap-1 text-xs">
                                    <DollarSign className="w-3 h-3" />${configAverages.avgCost}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Average Cost: ${configAverages.avgCost}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {!["steps", "latency", "cost"].includes(filter) && configAverages.avgScore !== null && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="default" className="gap-1 text-xs">
                                    <FilterIcon className="w-3 h-3" />
                                    {configAverages.avgScore}%
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Average Judge Score: {configAverages.avgScore}%</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {/* Show other metrics as secondary */}
                            {filter !== "steps" && configAverages.avgStepCount !== null && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="gap-1 text-xs">
                                    <ListOrdered className="w-3 h-3" />
                                    {configAverages.avgStepCount} steps
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Average # of Steps: {configAverages.avgStepCount}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {filter !== "latency" && configAverages.avgLatency !== null && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="gap-1 text-xs">
                                    <Clock className="w-3 h-3" />
                                    {configAverages.avgLatency}s
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Average Latency: {configAverages.avgLatency}s</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {filter !== "cost" && configAverages.avgCost !== null && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="gap-1 text-xs">
                                    <DollarSign className="w-3 h-3" />${configAverages.avgCost}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Average Cost: ${configAverages.avgCost}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {uniqueInputs.map((input, idx) => {
                      const key = `${config.id}-${input}`
                      const configTraces = tracesByConfigAndInput[key] || []
                      const latestTrace = configTraces[configTraces.length - 1]
                      const traceScore = latestTrace ? calculateTraceScore(latestTrace, filter) : null
                      const traceLatency = latestTrace ? calculateLatency(latestTrace) : null
                      const traceCost = latestTrace ? calculateCost(latestTrace) : null

                      return (
                        <TableCell 
                          key={idx}
                          className={latestTrace ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
                          onClick={latestTrace ? () => onLoadConfigAndInput?.(config.id, input, latestTrace.id) : undefined}
                        >
                          {latestTrace ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant={
                                    latestTrace.status === "completed"
                                      ? "default"
                                      : latestTrace.status === "error"
                                        ? "destructive"
                                        : "secondary"
                                  }
                                >
                                  {latestTrace.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{latestTrace.steps.length} steps</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {filter === "steps" && (
                                  <Badge variant="default" className="gap-1 text-xs">
                                    <ListOrdered className="w-3 h-3" />
                                    {latestTrace.steps.length} steps
                                  </Badge>
                                )}
                                {filter === "latency" && traceLatency !== null && (
                                  <Badge variant="default" className="gap-1 text-xs">
                                    <Clock className="w-3 h-3" />
                                    {traceLatency.toFixed(2)}s
                                  </Badge>
                                )}
                                {filter === "cost" && traceCost !== null && (
                                  <Badge variant="default" className="gap-1 text-xs">
                                    <DollarSign className="w-3 h-3" />${traceCost.toFixed(4)}
                                  </Badge>
                                )}
                                {!["steps", "latency", "cost"].includes(filter) && traceScore !== null && (
                                  <Badge variant="default" className="gap-1 text-xs">
                                    <FilterIcon className="w-3 h-3" />
                                    {traceScore}%
                                  </Badge>
                                )}
                                {/* Show other metrics as secondary */}
                                {filter !== "latency" && traceLatency !== null && (
                                  <Badge variant="outline" className="gap-1 text-xs">
                                    <Clock className="w-3 h-3" />
                                    {traceLatency.toFixed(2)}s
                                  </Badge>
                                )}
                                {filter !== "cost" && traceCost !== null && (
                                  <Badge variant="outline" className="gap-1 text-xs">
                                    <DollarSign className="w-3 h-3" />${traceCost.toFixed(4)}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border">
                                {(() => {
                                  const finalResponse = getFinalResponse(latestTrace)
                                  return finalResponse ? truncateText(finalResponse) : "No response available"
                                })()}
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-sm text-muted-foreground hover:text-primary hover:bg-muted"
                              onClick={() => onLoadConfigAndInput?.(config.id, input)}
                            >
                              No trace - Click to run
                            </Button>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

    </div>
    </TooltipProvider>
  )
}
