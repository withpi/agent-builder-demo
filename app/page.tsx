"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AgentBuilderPanel } from "@/components/agent-builder-panel"
import { RubricBuilderPanel } from "@/components/rubric-builder-panel"
import { EvaluateAgentPanel } from "@/components/evaluate-agent-panel"
import { AgentProvider } from "@/lib/agent-context"
import { MessageCircle, Calendar, Github, BookOpen, Code } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import Image from 'next/image';
import piLogo from '@/public/pi-logo.svg';
import Link from "next/link";


export default function Home() {
  const [activeTab, setActiveTab] = useState("build-agent")
  const [openCodeModal, setOpenCodeModal] = useState<string | null>(null)
  const [pendingConfigLoad, setPendingConfigLoad] = useState<{ configId: string; input: string } | null>(null)

  const codeSnippets = {
    feedback: `// Give feedback on your agent's traces
import { pi } from '@pipedream/pi'

// Annotate a trace with feedback
await pi.feedback.create({
  traceId: "trace_123",
  feedback: {
    rating: "positive",
    comment: "Agent handled the query perfectly",
    category: "response_quality"
  }
})

// Add detailed annotations
await pi.trace.annotate({
  traceId: "trace_123",
  annotations: {
    strengths: ["Clear communication", "Accurate information"],
    improvements: ["Could be more concise"]
  }
})`,
    evaluate: `// Use Pi Judge to evaluate agents
import { pi } from '@pipedream/pi'

// Create a judge from your feedback
const judge = await pi.judge.create({
  name: "Response Quality Judge",
  criteria: "Evaluate response quality based on user feedback"
})

// Run evaluation on traces
const evaluation = await pi.evaluate({
  judgeId: judge.id,
  traces: ["trace_123", "trace_456", "trace_789"]
})

// Compare different agent versions
const comparison = await pi.compare({
  judges: [judge.id],
  agentVersions: ["v1.0", "v2.0"],
  testSet: "production_samples"
})`,
    align: `// Use Pi Judge to align your agent
import { pi } from '@pipedream/pi'

// Create alignment controls from feedback
const control = await pi.control.create({
  name: "Safety Guard",
  rules: "Ensure responses follow safety guidelines",
  basedOnFeedback: true
})

// Apply control to your agent
await pi.agent.applyControl({
  agentId: "agent_123",
  controlId: control.id,
  mode: "enforce"
})

// Monitor alignment in production
const alignment = await pi.monitor.alignment({
  agentId: "agent_123",
  metrics: ["safety", "quality", "coherence"]
})`,
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
            <Dialog open={openCodeModal === "feedback"} onOpenChange={(open) => !open && setOpenCodeModal(null)}>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Give Feedback - Code Example</DialogTitle>
                  <DialogDescription>Here's how to annotate your agent's traces with feedback</DialogDescription>
                </DialogHeader>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{codeSnippets.feedback}</code>
                </pre>
              </DialogContent>
            </Dialog>

            <Dialog open={openCodeModal === "evaluate"} onOpenChange={(open) => !open && setOpenCodeModal(null)}>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Evaluate Agents - Code Example</DialogTitle>
                  <DialogDescription>Here's how to use Pi Judge to evaluate and compare agents</DialogDescription>
                </DialogHeader>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{codeSnippets.evaluate}</code>
                </pre>
              </DialogContent>
            </Dialog>

            <Dialog open={openCodeModal === "align"} onOpenChange={(open) => !open && setOpenCodeModal(null)}>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Align Your Agent - Code Example</DialogTitle>
                  <DialogDescription>Here's how to use Pi Judge to create alignment controls</DialogDescription>
                </DialogHeader>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{codeSnippets.align}</code>
                </pre>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
    </AgentProvider>
  )
}
