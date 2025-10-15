"use client"

import { useState, useMemo, useEffect } from "react"
import { useAgent } from "@/lib/agent-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Award, Clock, DollarSign, ListOrdered, Wrench } from "lucide-react"

// Helper function to get the final response from a trace
const getFinalResponse = (trace: any): string => {
  const responseStep = trace.steps.find((step: any) => step.type === "RESPONSE")
  return responseStep?.content || ""
}


// Helper function to render trace cell content
const renderTraceCell = (
  latestTrace: any,
  traceScore: number | null,
  traceLatency: number | null,
  traceCost: number | null,
  onLoadConfigAndInput?: (configId: string, input: string, traceId?: string) => void,
  configId?: string,
  input?: string
) => {
  if (latestTrace) {
    return (
      <div className="space-y-4 w-[300px] min-w-[300px] max-w-[300px]">
        <div className="text-xs p-2">
          {(() => {
            const finalResponse = getFinalResponse(latestTrace)
            return finalResponse ? finalResponse : "No response available"
          })()}
        </div>
        <div className="flex flex-wrap gap-2">
          {traceScore !== null && (
            <Badge variant="default" className="gap-1 text-xs">
              <Award className="w-3 h-3" />
              {traceScore}%
            </Badge>
          )}
          <Badge variant="outline" className="gap-1 text-xs">
              <ListOrdered className="w-3 h-3" />
              {latestTrace.steps.length} steps
            </Badge>
          {traceLatency !== null && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Clock className="w-3 h-3" />
              {traceLatency.toFixed(2)}s
            </Badge>
          )}
          {traceCost !== null && (
            <Badge variant="outline" className="gap-1 text-xs">
              <DollarSign className="w-3 h-3" />${traceCost.toFixed(4)}
            </Badge>
          )}
        </div>
        
      </div>
    )
  } else {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-sm text-muted-foreground hover:text-primary hover:bg-muted"
        onClick={() => onLoadConfigAndInput?.(configId!, input!)}
      >
        No trace - Click to run
      </Button>
    )
  }
}
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


export function EvaluateAgentPanel({
  onLoadConfigAndInput,
}: {
  onLoadConfigAndInput?: (configId: string, input: string, traceId?: string) => void
}) {
  const { traces, configs, rubrics } = useAgent()

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


  const calculateTraceScore = (trace: (typeof traces)[0]) => {
    const relevantSteps = trace.steps.filter((s) => s.score && !s.score.isLoading)

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

    const scores = configTraces.map((t) => calculateTraceScore(t)).filter((s) => s !== null) as number[]
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


  return (
    <TooltipProvider>
      <div className="p-6">

      {traces.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No traces available. Run the agent to generate traces.
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto">
            <Table className="border-collapse table-fixed">
              <TableHeader>
                <TableRow className="sticky top-0">
                  <TableHead 
                    className="sticky left-0 top-0 z-20 bg-gray-100 border-r w-[250px]"
                  >
                    Configuration
                  </TableHead>
                  {uniqueInputs.map((input, idx) => (
                    <TableHead 
                      key={idx} 
                      className="sticky top-0 border-r bg-muted/50 z-10 w-[500px]">
                      {input}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => {
                  const configAverages = calculateConfigAverages(config.id, uniqueInputs)

                  return (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium sticky left-0 bg-gray-100 z-10 border-r">
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs font-medium">
                                {config.model}
                              </Badge>
                              {config.usePiJudge && config.rubricVersions && Object.keys(config.rubricVersions).length > 0 && (
                                <Badge variant="default" className="text-xs">
                                  Guardrails ({Object.keys(config.rubricVersions).length})
                                </Badge>
                              )}
                               {config.toolSlugs && config.toolSlugs.length > 0 && (
                                 <Tooltip>
                                   <TooltipTrigger asChild>
                                     <Badge variant="outline" className="text-xs">
                                       Tools ({config.toolSlugs.length})
                                     </Badge>
                                   </TooltipTrigger>
                                   <TooltipContent className="z-50">
                                     <p>{config.toolSlugs.join(', ')}</p>
                                   </TooltipContent>
                                 </Tooltip>
                               )}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-3" >
                              {config.systemPrompt}
                            </div>
                          </div>
                          {configAverages && (
                            <div className="mt-6">
                              <p className="text-xs font-medium text-muted-foreground mb-2 italic">Average Performance</p>
                              <div className="flex flex-wrap gap-2">
                              {configAverages.avgScore !== null && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="default" className="gap-1 text-xs">
                                      <Award className="w-3 h-3" />
                                      {configAverages.avgScore}%
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Average Judge Score: {configAverages.avgScore}%</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {configAverages.avgStepCount !== null && (
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
                              {configAverages.avgLatency !== null && (
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
                              {configAverages.avgCost !== null && (
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
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {uniqueInputs.map((input, idx) => {
                        const key = `${config.id}-${input}`
                        const configTraces = tracesByConfigAndInput[key] || []
                        const latestTrace = configTraces[configTraces.length - 1]
                        const traceScore = latestTrace ? calculateTraceScore(latestTrace) : null
                        const traceLatency = latestTrace ? calculateLatency(latestTrace) : null
                        const traceCost = latestTrace ? calculateCost(latestTrace) : null

                        return (
                          <TableCell 
                            key={idx}
                            className={`border-r overflow-hidden min-w-[300px] max-w-[300px] ${latestTrace ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
                            onClick={latestTrace ? () => onLoadConfigAndInput?.(config.id, input, latestTrace.id) : undefined}
                          >
                            {renderTraceCell(
                              latestTrace,
                              traceScore,
                              traceLatency,
                              traceCost,
                              onLoadConfigAndInput,
                              config.id,
                              input
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
