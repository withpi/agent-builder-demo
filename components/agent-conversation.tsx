"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Play, Square, ChevronRight, Settings, Layers } from "lucide-react"
import { useAgent } from "@/lib/agent-context"
import { StepCard } from "./step-card"
import { Spinner } from "@/components/ui/spinner"

export function AgentConversation({
  usePiJudge,
  rubrics,
  isConfigCollapsed,
  onToggleConfig,
  pendingInput,
  onInputLoaded,
}: {
  usePiJudge: boolean
  rubrics: any[]
  isConfigCollapsed: boolean
  onToggleConfig: () => void
  pendingInput?: string | null
  onInputLoaded?: () => void
}) {
  const {
    currentConfig,
    currentTrace,
    addTrace,
    setCurrentTrace,
    updateTrace,
    addStepToTrace,
    updateStepScore,
    scoreStep,
    getRubricsByStepType,
    getRubricsByToolNameAndType,
    findOrCreateConfig,
    setCurrentConfig,
  } = useAgent()
  const [input, setInput] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Ref for the sentinel element (the target)
  const sentinelRef = useRef(null);

  const [streamingSteps, setStreamingSteps] = useState<
    Map<
      string,
      {
        type: string
        content: string
        toolName?: string
        toolInput?: any
        toolOutput?: any
        toolCallId?: string
      }
    >
  >(new Map())
  const [finalizedStepIds, setFinalizedStepIds] = useState<Set<string>>(new Set())
  const pendingStepsRef = useRef<Array<{ traceId: string; step: any; stepId: string }>>([])
  const isProcessingRef = useRef(false)
  const addedStepIdsRef = useRef<Set<string>>(new Set())
  const [scrolledToBottom, setScrolledToBottom] = useState(false)

  useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput)
      onInputLoaded?.()
    }
  }, [pendingInput, onInputLoaded])



  const scrollOffset = 500;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollRef.current;

    if (!sentinel || !container) return; // Exit if refs aren't set

    // Options for the Intersection Observer
    const options = {
      // The element whose bounds are used as the viewport.
      // Here, it's our scrollable container.
      root: container,

      // Margin around the root. '0px' means no extra margin.
      rootMargin: `${scrollOffset}px`, // Shrinks the bottom margin by 50px

      // The percentage of the target's visibility needed to trigger the callback.
      // 1.0 means 100% of the target must be visible.
      threshold: 1.0,

    };
    const callback = (entries: { isIntersecting: any }[]) => {
      // The callback is called when the target's visibility changes.
      // entries[0].isIntersecting is true when the sentinel is visible.

      const isIntersecting = entries[0].isIntersecting;

      setScrolledToBottom(isIntersecting);

    };

    const observer = new IntersectionObserver(callback, options);
    // Start observing the sentinel element
    observer.observe(sentinel);

    // Cleanup function: disconnect the observer when the component unmounts
    return () => observer.disconnect();

    // Re-run effect if container/sentinel changes, though they shouldn't in this case
  }, [scrollOffset]);

  useEffect(() => {
    if (scrollRef.current) {
      if (scrolledToBottom) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
        })
      }
    }
  }, [currentTrace?.steps, streamingSteps])

  useEffect(() => {
    if (isProcessingRef.current || pendingStepsRef.current.length === 0) {
      return
    }

    isProcessingRef.current = true

    const stepsToAdd = [...pendingStepsRef.current]
    pendingStepsRef.current = []

    console.log("[v0] Processing pending steps:", stepsToAdd.length)

    stepsToAdd.forEach(async ({ traceId, step, stepId }) => {
      if (addedStepIdsRef.current.has(stepId)) {
        console.log("[v0] Skipping duplicate step:", stepId)
        return
      }

      console.log("[v0] Adding step to trace:", stepId, step.type)
      addStepToTrace(traceId, step)
      addedStepIdsRef.current.add(stepId)

      if (
        step.type === "ACTION" ||
        step.type === "OBSERVATION" ||
        step.type === "RESPONSE" ||
        step.type === "THINKING"
      ) {
        console.log("[v0] Scoring step:", stepId, step.type)

        let rubric

        if (step.type === "RESPONSE") {
          const rubrics = getRubricsByStepType("RESPONSE")
          rubric = rubrics[rubrics.length - 1]
          console.log("[v0] Found RESPONSE rubric:", rubric?.id, "with", rubric?.questions.length, "questions")
        } else if (step.type === "THINKING") {
          const rubrics = getRubricsByStepType("THINKING")
          rubric = rubrics[rubrics.length - 1]
          console.log("[v0] Found THINKING rubric:", rubric?.id, "with", rubric?.questions.length, "questions")
        } else if (step.type === "ACTION" && step.toolName) {
          const rubrics = getRubricsByToolNameAndType(step.toolName, "tool-call")
          rubric = rubrics[rubrics.length - 1]
          console.log(
            "[v0] Found ACTION rubric for",
            step.toolName,
            ":",
            rubric?.id,
            "with",
            rubric?.questions.length,
            "questions",
          )
        } else if (step.type === "OBSERVATION" && step.toolName) {
          const rubrics = getRubricsByToolNameAndType(step.toolName, "tool-result")
          rubric = rubrics[rubrics.length - 1]
          console.log(
            "[v0] Found OBSERVATION rubric for",
            step.toolName,
            ":",
            rubric?.id,
            "with",
            rubric?.questions.length,
            "questions",
          )
        }

        if (rubric && rubric.questions.length > 0 && currentTrace) {
          console.log("[v0] Calling scoreStep for", stepId, "with rubric", rubric.id)

          // Get the full trace with the newly added step
          const fullStep = { ...step, timestamp: Date.now() }
          const updatedTrace = {
            ...currentTrace,
            steps: [...currentTrace.steps, fullStep],
          }

          const score = await scoreStep(fullStep, updatedTrace, rubric)

          if (score) {
            console.log("[v0] Score received:", score.total, "- updating state")
            updateStepScore(traceId, stepId, score)
          }
        } else {
          console.log("[v0] No rubric found or rubric has no questions for step", stepId)
        }
      }
    })

    isProcessingRef.current = false
  }, [
    streamingSteps,
    addStepToTrace,
    updateStepScore,
    scoreStep,
    getRubricsByStepType,
    getRubricsByToolNameAndType,
    currentTrace,
  ])

  const handleStart = async () => {
    if (!input.trim() || !currentConfig) return

    setIsRunning(true)
    setStreamingSteps(new Map())
    setFinalizedStepIds(new Set())
    pendingStepsRef.current = []
    addedStepIdsRef.current = new Set()
    isProcessingRef.current = false

    const activeConfig = findOrCreateConfig(
      currentConfig.model,
      currentConfig.systemPrompt,
      currentConfig.toolSlugs,
      usePiJudge,
      rubrics,
    )

    // Update current config if it changed
    if (activeConfig.id !== currentConfig.id) {
      setCurrentConfig(activeConfig)
    }

    // Create new trace with the active config
    const trace = addTrace({
      configId: activeConfig.id,
      input: input.trim(),
      steps: [],
      status: "running",
    })

    setCurrentTrace(trace)

    try {
      let rubricsToSend: any[] = []
      if (usePiJudge) {
        rubricsToSend = rubrics.filter((rubric) => {
          // Include response rubrics (final response evaluation)
          if (rubric.rubricType === "response") {
            return true
          }

          // Include thinking rubrics
          if (rubric.rubricType === "thinking") {
            return true
          }

          // Include tool-specific rubrics that match the app slugs
          if (!rubric.toolName) return false
          return activeConfig.toolSlugs.some(
            (appSlug) => rubric.toolName == appSlug,
          )
        })
        console.log(
          "[v0] Sending rubrics to agent:",
          rubricsToSend.length,
          "including response rubrics:",
          rubricsToSend.filter((r) => r.rubricType === "response").length,
          "thinking rubrics:",
          rubricsToSend.filter((r) => r.rubricType === "thinking").length,
        )
      }

      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: activeConfig,
          input: input.trim(),
          traceId: trace.id,
          toolNames: activeConfig.toolSlugs,
          usePiJudge,
          rubrics: rubricsToSend,
        }),
      })

      if (!response.ok) throw new Error("Failed to run agent")

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader available")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === "step-start") {
                // Initialize a new streaming step
                console.log("[v0] Step start:", data.stepId, data.stepType)
                setStreamingSteps((prev) => {
                  const next = new Map(prev)
                  next.set(data.stepId, {
                    type: data.stepType,
                    content: "",
                    toolName: data.toolName,
                    toolInput: data.toolInput,
                    toolOutput: data.toolOutput,
                    toolCallId: data.toolCallId,
                  })
                  return next
                })
              } else if (data.type === "token") {
                setStreamingSteps((prev) => {
                  const next = new Map(prev)
                  const step = next.get(data.stepId)
                  if (step) {
                    next.set(data.stepId, {
                      ...step,
                      content: step.content + data.delta,
                    })
                  }
                  return next
                })
              } else if (data.type === "step-type-change") {
                console.log("[v0] Step type change:", data.stepId, "to", data.newStepType)
                setStreamingSteps((prev) => {
                  const next = new Map(prev)
                  const step = next.get(data.stepId)
                  if (step) {
                    next.set(data.stepId, {
                      ...step,
                      type: data.newStepType,
                    })
                  }
                  return next
                })
              } else if (data.type === "step-end") {
                console.log("[v0] Step end:", data.stepId)
                setFinalizedStepIds((prev) => new Set(prev).add(data.stepId))

                setStreamingSteps((prev) => {
                  const streamingStep = prev.get(data.stepId)

                  if (streamingStep) {
                    console.log("[v0] Queueing step:", data.stepId, streamingStep.type)
                    pendingStepsRef.current.push({
                      traceId: trace.id,
                      stepId: data.stepId,
                      step: {
                        id: data.stepId,
                        type: streamingStep.type as any,
                        content: streamingStep.content,
                        toolName: streamingStep.toolName,
                        toolInput: streamingStep.toolInput,
                        toolOutput: streamingStep.toolOutput,
                        toolCallId: streamingStep.toolCallId,
                      },
                    })
                  }

                  // Remove from streaming steps
                  const next = new Map(prev)
                  next.delete(data.stepId)
                  return next
                })
              } else if (data.type === "step") {
                // Legacy support for old step format
                console.log("[v0] Received step:", data.step)
                addStepToTrace(trace.id, data.step)
              } else if (data.type === "complete") {
                updateTrace(trace.id, { status: "completed" })
              } else if (data.type === "error") {
                updateTrace(trace.id, { status: "error" })
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e)
            }
          }
        }
      }
    } catch (error) {
      console.error("Error running agent:", error)
      if (currentTrace) {
        updateTrace(currentTrace.id, { status: "error" })
      }
    } finally {
      setIsRunning(false)
      setStreamingSteps(new Map())
      setFinalizedStepIds(new Set())
    }
  }

  const handleStop = () => {
    setIsRunning(false)
    if (currentTrace) {
      updateTrace(currentTrace.id, { status: "completed" })
    }
  }


  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b flex-shrink-0">
        {isConfigCollapsed && (
          <Button variant="ghost" onClick={onToggleConfig} className="h-8 px-2 gap-1">
            <Settings className="w-4 h-4" />
            <ChevronRight className="w-3 h-3" />
          </Button>
        )}
        <h2 className="text-lg font-semibold">Agent Conversation</h2>
      </div>

      <div className="flex flex-col overflow-hidden flex-1">
        <div className="p-6 pb-4 flex-shrink-0">
          <h3 className="text-sm font-medium">Execution Trace</h3>
        </div>
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-6 pb-6">
          <div className="w-full space-y-3 pr-4">
            {currentTrace?.steps.map((step) => (
              <StepCard key={step.id} step={step} traceId={currentTrace.id} />
            ))}
            {Array.from(streamingSteps.entries())
              .filter(([stepId]) => !finalizedStepIds.has(stepId))
              .map(([stepId, step]) => (
                <StepCard
                  key={stepId}
                  step={{
                    id: stepId,
                    type: step.type as any,
                    content: step.content,
                    toolName: step.toolName,
                    toolInput: step.toolInput,
                    toolOutput: step.toolOutput,
                    toolCallId: step.toolCallId,
                    timestamp: Date.now(),
                  }}
                  traceId={currentTrace?.id || ""}
                  isStreaming={true}
                />
              ))}
            {isRunning && streamingSteps.size === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg border border-dashed">
                <Spinner className="w-4 h-4" />
                <span>Agent is thinking...</span>
              </div>
            )}
          </div>
          <div ref={sentinelRef} className={'h-1 w-full '} />

        </div>
      </div>

      <div className="p-6 border-t bg-muted/30 flex-shrink-0">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Press Enter to send, Shift+Enter for new line"
            className="min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (!isRunning) handleStart()
              }
            }}
            disabled={isRunning}
          />
          <div className="flex flex-col gap-2">
            <Button onClick={handleStart} disabled={isRunning || !input.trim()} className="gap-2">
              <Play className="w-4 h-4" />
              Start
            </Button>
            <Button onClick={handleStop} disabled={!isRunning} variant="destructive" className="gap-2">
              <Square className="w-4 h-4" />
              Stop
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
