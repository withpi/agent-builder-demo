"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AgentBuilderPanel } from "@/components/agent-builder-panel"
import { RubricBuilderPanel } from "@/components/rubric-builder-panel"
import { EvaluateAgentPanel } from "@/components/evaluate-agent-panel"
import { AgentProvider } from "@/lib/agent-context"
import { MessageCircle, Calendar, Github, BookOpen, Code } from "lucide-react"
import Image from 'next/image';
import piLogo from '@/public/pi-logo.svg';
import Link from "next/link";
import { CodeSnippetModal } from "@/components/code-snippet-modal"


export default function Home() {
  const [activeTab, setActiveTab] = useState("build-agent")
  const [openCodeModal, setOpenCodeModal] = useState<string | null>(null)
  const [pendingConfigLoad, setPendingConfigLoad] = useState<{ configId: string; input: string } | null>(null)

  const codeSnippets = {
    feedback: `// How feedback is organized in Pi Agent Builder
// Each feedback captures the step's input and output context

// Example: Submitting feedback for an ACTION step (tool call)
const handleFeedbackSubmit = async () => {
  const stepIndex = currentTrace.steps.findIndex((s) => s.id === step.id)
  const precedingSteps = currentTrace.steps.slice(0, stepIndex)
  
  // Use prepareActionFromSteps to split input/output
  const scoringData = await prepareActionFromSteps(
    precedingSteps,
    step.toolName,
    step.toolInput,
    currentTrace.input
  )
  
  // scoringData contains:
  // - input: Messages before the tool call (excluding parallel calls)
  // - output: { toolName, toolInput }
  
  await addFeedback(traceId, step.id, {
    stepType: "ACTION",
    toolName: step.toolName,
    rating: "up" | "down",
    description: "Your feedback here",
    input: scoringData.input,    // Context before action
    output: scoringData.output    // Tool call details
  })
}

// Similar patterns for other step types:
// - prepareResponseFromSteps(query, response)
// - prepareThinkingFromSteps(precedingSteps, thinking, input)
// - prepareObservationFromSteps(toolName, toolInput, toolOutput)`,
    evaluate: `// How Pi Agent Builder evaluates steps with rubrics
// The scoreStep function scores any step against its rubric

const scoreStep = async (
  step: AgentStep, 
  trace: AgentTrace, 
  rubric?: Rubric
): Promise<StepScore | null> => {
  // 1. Find the appropriate rubric for this step type
  let targetRubric = rubric
  if (!targetRubric) {
    if (step.type === "RESPONSE") {
      const rubrics = getRubricsByStepType("RESPONSE")
      targetRubric = rubrics[rubrics.length - 1]
    } else if (step.type === "ACTION" && step.toolName) {
      const rubrics = getRubricsByToolNameAndType(step.toolName, "tool-call")
      targetRubric = rubrics[rubrics.length - 1]
    }
    // ... similar for THINKING and OBSERVATION
  }

  if (!targetRubric || targetRubric.questions.length === 0) {
    return null
  }

  // 2. Prepare input/output context for scoring
  const precedingSteps = trace.steps.filter(
    (s) => s.timestamp <= step.timestamp && s.id !== step.id
  )

  let scoringData
  if (step.type === "ACTION") {
    scoringData = await prepareActionFromSteps(
      precedingSteps, 
      step.toolName!, 
      step.toolInput, 
      trace.input
    )
  }
  // ... similar for other step types

  // 3. Score against rubric questions
  const scoredData = await getScoredData([scoringData], targetRubric.questions)

  // 4. Return structured score with question breakdown
  return {
    rubricId: targetRubric.id,
    total: scoredData[0].score,
    questionScores: scoredData[0].questionScores.map(qs => ({
      label: qs.label,
      question: targetRubric.questions.find(q => q.label === qs.label)?.question || "",
      score: qs.score,
    })),
    timestamp: Date.now(),
  }
}`,
    align: `// How Pi Agent Builder steers the model based on step scores
// The prepareStep hook runs before each model call to inject feedback

prepareStep: async ({ steps, stepNumber, messages }) => {
  const lastStep = steps[steps.length - 1]
  const failedChecks = []

  // 1. Score the last step against its rubric
  if (lastStep.toolCalls) {
    for (const toolCall of lastStep.toolCalls) {
      const rubric = rubricsByToolCall.get(toolCall.toolName)
      if (rubric) {
        const scoringData = prepareActionFromMessages(
          messagesBeforeToolCall, 
          toolCall.toolName, 
          toolCall.input
        )
        const scoredData = await getScoredData([scoringData], rubric.questions)
        const threshold = rubric.threshold || 0.5

        // 2. If score below threshold, collect failed criteria
        if (scoredData[0].score < threshold) {
          const lowScoringCriteria = scoredData[0].questionScores
            .filter(qs => qs.score < threshold)
            .map(qs => {
              const question = rubric.questions.find(q => q.label === qs.label)
              return \`  - \${question?.question}: \${Math.round(qs.score * 100)}%\`
            })

          failedChecks.push({
            toolName: toolCall.toolName,
            score: scoredData[0].score,
            threshold,
            lowScoringCriteria
          })
        }
      }
    }
  }

  // 3. If checks failed, inject corrective feedback into messages
  if (failedChecks.length > 0) {
    const feedbackMessage = \`🚫 STOP - YOUR LAST ACTION WAS REJECTED

The system blocked your step because it failed quality standards.

**Quality gaps identified:**
\${failedChecks[0].lowScoringCriteria.join('\\n')}

**YOU MUST DO THIS NOW:**
1. Review each quality gap above
2. Understand WHY each criterion failed
3. Revise your approach to address EVERY failed criterion
4. Re-execute the corrected action

DO NOT proceed with different actions. RETRY with corrections.\`

    // Inject feedback as a user message to steer the model
    return { 
      messages: [...messages, { 
        role: 'user', 
        content: feedbackMessage 
      }] 
    }
  }

  return { messages }
}`,
  }

  return (
    <AgentProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 overflow-hidden flex-col">
          <header className="flex items-center justify-between gap-6 px-6 py-4 border-b">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Link href={'https://withpi.ai'} target={'_blank'} className="flex items-center justify-center w-6 h-6 rounded-lg ">
                  <Image src={piLogo} alt={"Pi Labs logo"}/>
                </Link>
                <h1 className="text-2xl font-bold">Pi Agent Builder</h1>
              </div>
              <TabsList>
                <TabsTrigger value="build-agent">Build Agent</TabsTrigger>
                <TabsTrigger value="build-judges">Build Pi Judges</TabsTrigger>
                <TabsTrigger value="evaluate-agent">Evaluate Agent</TabsTrigger>
                <TabsTrigger value="about">About</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex items-center gap-6">
              {/* Get in touch section */}
              <div className="flex items-center gap-3 border-r pr-6">
                <span className="text-sm font-medium text-muted-foreground">Get in touch</span>
                <a
                  href="https://discord.gg/zcjXygYMe5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                  title="Join our Discord"
                >
                  <MessageCircle className="w-4 h-4" />
                  Discord
                </a>
                <a
                  href="https://calendar.app.google/wvGTUqNLcUberikD8"
                  target="_blank"
                  className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                  title="Schedule time with Pi"
                  rel="noreferrer"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule
                </a>
              </div>

              {/* Use the code section */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Use the code</span>
                <a
                  href="https://github.com/withpi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                  title="View on GitHub"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
                <a
                  href="https://code.withpi.ai/"
                  target="_blank"
                  className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                  title="Pi Documentation"
                  rel="noreferrer"
                >
                  <BookOpen className="w-4 h-4" />
                  Docs
                </a>
              </div>
            </div>
          </header>

          <TabsContent value="build-agent" className="flex-1 mt-0 overflow-hidden">
            <AgentBuilderPanel
              pendingConfigLoad={pendingConfigLoad}
              onConfigLoaded={() => setPendingConfigLoad(null)}
            />
          </TabsContent>

          <TabsContent value="build-judges" className="flex-1 overflow-hidden mt-0">
            <RubricBuilderPanel />
          </TabsContent>

          <TabsContent value="evaluate-agent" className="flex-1 overflow-hidden mt-0">
            <EvaluateAgentPanel
              onLoadConfigAndInput={(configId: string, input: string) => {
                setPendingConfigLoad({ configId, input })
                setActiveTab("build-agent")
              }}
            />
          </TabsContent>

          <TabsContent value="about" className="flex-1 mt-0 p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-12">
              {/* Part 1: Give your agent feedback */}
              <div className="flex gap-8 items-center">
                <div className="flex-[0.6] aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                  <div className="text-center space-y-2">
                    <svg
                      className="w-12 h-12 mx-auto text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-muted-foreground text-sm">Video Placeholder</p>
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <h2 className="text-3xl font-bold">Give your agent feedback. Watch that turn into judges</h2>
                  <p className="text-muted-foreground text-lg">
                    Annotate your agent's traces with your feedback. Highlight what works well and what needs
                    improvement. Your insights become the foundation for making your agent better.
                  </p>
                  <button
                    onClick={() => setOpenCodeModal("feedback")}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Code className="w-4 h-4" />
                    See the code
                  </button>
                </div>
              </div>

              {/* Part 2: Your feedback turns into evaluations */}
              <div className="flex gap-8 items-center">
                <div className="flex-[0.6] aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                  <div className="text-center space-y-2">
                    <svg
                      className="w-12 h-12 mx-auto text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-muted-foreground text-sm">Video Placeholder</p>
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <h2 className="text-3xl font-bold">Use Pi Judge to evaluate and compare agents</h2>
                  <p className="text-muted-foreground text-lg">
                    Pi automatically converts your feedback into evaluation judges. These judges continuously measure
                    your agent's performance, giving you clear metrics on what's working and what's not.
                  </p>
                  <button
                    onClick={() => setOpenCodeModal("evaluate")}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Code className="w-4 h-4" />
                    See the code
                  </button>
                </div>
              </div>

              {/* Part 3: Your feedback improves your agent */}
              <div className="flex gap-8 items-center">
                <div className="flex-[0.6] aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                  <div className="text-center space-y-2">
                    <svg
                      className="w-12 h-12 mx-auto text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-muted-foreground text-sm">Video Placeholder</p>
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <h2 className="text-3xl font-bold">Use Pi Judge to align your agent</h2>
                  <p className="text-muted-foreground text-lg">
                    Your feedback becomes actionable improvements. Pi uses your insights to generate online controls and
                    refinements that make your agent smarter and more reliable over time.
                  </p>
                  <button
                    onClick={() => setOpenCodeModal("align")}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Code className="w-4 h-4" />
                    See the code
                  </button>
                </div>
              </div>
            </div>

            {/* Code Modals */}
            <CodeSnippetModal
              open={openCodeModal === "feedback"}
              onOpenChange={(open) => !open && setOpenCodeModal(null)}
              title="Give Feedback - Code Example"
              description="Here's how to annotate your agent's traces with feedback"
              code={codeSnippets.feedback}
              fileName="components/step-card.tsx"
            />

            <CodeSnippetModal
              open={openCodeModal === "evaluate"}
              onOpenChange={(open) => !open && setOpenCodeModal(null)}
              title="Evaluate Agents - Code Example"
              description="Here's how to use Pi Judge to evaluate and compare agents"
              code={codeSnippets.evaluate}
              fileName="lib/agent-context.tsx"
            />

            <CodeSnippetModal
              open={openCodeModal === "align"}
              onOpenChange={(open) => !open && setOpenCodeModal(null)}
              title="Align Your Agent - Code Example"
              description="Here's how to use Pi Judge to create alignment controls"
              code={codeSnippets.align}
              fileName="app/api/agent/run/route.ts"
            />
          </TabsContent>
        </Tabs>
      </div>
    </AgentProvider>
  )
}
