import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ChevronLeft, Settings, Plus, X, Loader2, Download, ChevronDown, ChevronDownIcon, ChevronUpIcon, Wand2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useAgent } from "@/lib/agent-context"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {AVAILABLE_TOOLS} from "@/lib/tools";

interface AgentConfigurationProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
  usePiJudge: boolean
  onUsePiJudgeChange: (value: boolean) => void
}

const toolsToRender = Object.entries(AVAILABLE_TOOLS);
export function AgentConfiguration({
  isCollapsed,
  onToggleCollapse,
  usePiJudge,
  onUsePiJudgeChange,
}: AgentConfigurationProps) {
  const { currentConfig, updateConfig, rubrics } = useAgent()
  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false)
  const [mcpEndpoint, setMcpEndpoint] = useState("")
  const [mcpApiKey, setMcpApiKey] = useState("")
  const [isCustomEndpointModalOpen, setIsCustomEndpointModalOpen] = useState(false)
  const [customEndpoint, setCustomEndpoint] = useState("")
  const [customApiKey, setCustomApiKey] = useState("")
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false)
  const [isSystemPromptExpanded, setIsSystemPromptExpanded] = useState(false)
  const { toast } = useToast()

  const getLatestRubricsByAction = (toolSlug: string) => {
    const allRubrics = rubrics.filter((rubric) => {
      return rubric.toolName?.startsWith(`${toolSlug}.`) || rubric.toolName?.startsWith(`${toolSlug}-`)
    })

    // Group by toolName and rubricType, keeping only the latest version
    const latestByActionAndType = new Map<string, (typeof allRubrics)[0]>()

    allRubrics.forEach((rubric) => {
      const key = `${rubric.toolName}-${rubric.rubricType}`
      const existing = latestByActionAndType.get(key)
      if (!existing || rubric.version > existing.version) {
        latestByActionAndType.set(key, rubric)
      }
    })

    // Group by toolName for display
    const byAction = new Map<string, { call?: (typeof allRubrics)[0]; result?: (typeof allRubrics)[0] }>()

    latestByActionAndType.forEach((rubric) => {
      const toolName = rubric.toolName!
      if (!byAction.has(toolName)) {
        byAction.set(toolName, {})
      }
      const action = byAction.get(toolName)!
      if (rubric.rubricType === "tool-call") {
        action.call = rubric
      } else {
        action.result = rubric
      }
    })

    return byAction
  }

  const handleToggleTool = (slug: string, checked: boolean) => {
    console.log("Checked", slug);
    if (checked) {
      updateConfig(currentConfig.id, {
        toolSlugs: currentConfig.toolSlugs.filter((s) => s !== slug),
      })
    } else if (Object.keys(AVAILABLE_TOOLS).includes(slug)) {
      updateConfig(currentConfig.id, {
        toolSlugs: [...currentConfig.toolSlugs, slug as keyof typeof AVAILABLE_TOOLS],
      })
    }
  }
  console.log(currentConfig);

  return (
    <div
      className={`flex-none sticky top-0 border-r bg-muted/30 transition-all duration-300 ${isCollapsed ? "w-0" : "w-96"} overflow-hidden`}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Agent Configuration</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="h-8 gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Export
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
              {isExportDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsExportDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-md border bg-popover shadow-lg z-50">
                    <div className="p-1">
                      <button
                        disabled
                        className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-sm text-muted-foreground cursor-not-allowed"
                      >
                        <span>Export as MCP</span>
                        <span className="text-xs">(Coming Soon)</span>
                      </button>
                      <button
                        disabled
                        className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-sm text-muted-foreground cursor-not-allowed"
                      >
                        <span>Export as API</span>
                        <span className="text-xs">(Coming Soon)</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 divide-y">
          <div className={'p-4'}>
            <Label className="text-base">Model</Label>

            <div className="mt-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Select a model:</Label>
                <Select
                  value={currentConfig.model}
                  onValueChange={(value: string) => {
                    if (value === "custom-endpoint") {
                      setIsCustomEndpointModalOpen(true)
                    } else {
                      updateConfig(currentConfig.id, { model: value as "gpt-4o" | "gpt-4o-mini" })
                    }
                  }}
                >
                  <SelectTrigger id="model" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o-mini</SelectItem>
                    <SelectItem value="custom-endpoint">Add your own inference endpoint (coming soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2 mt-3">
              <Label className="text-sm">Train a model (coming soon)</Label>
              <p className="text-xs text-muted-foreground">
                Pi judges act as your reward model to tune a model using Reinforcement Learning (RL) with just a few clicks.  
                <a 
                  href="https://colab.research.google.com/github/withpi/cookbook-withpi/blob/main/colabs/PiScorer_as_GRPO_Reward_Function.ipynb#scrollTo=bTnL_tJnzh2L" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary/80"
                >
                   See our GRPO code notebook to learn more
                </a>
              </p>
            </div>
          </div>
          <div className={'p-4 pb-6 pt-0 space-y-4'}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="pi-judge" className="text-base">Pi Judge as Guardrails</Label>
                <Switch id="pi-judge" checked={usePiJudge} onCheckedChange={onUsePiJudgeChange} />
              </div>
              <p className="text-sm text-muted-foreground">
                Your feedback creates judges for evaluation. Use the same judges as online guardrails for your agent to prevent mistakes
              </p>
            </div>
            
            
          </div>
          <div className="p-4 pt-0 pb-6 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="system-prompt" className="text-base">System Prompt</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="h-7 gap-1.5 text-muted-foreground opacity-50 cursor-not-allowed"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        Optimize
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="z-50">
                    <p>(Coming soon) Use Pi judges to optimize your System Prompt</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="relative">
              <Textarea
                id="system-prompt"
                value={currentConfig.systemPrompt}
                onChange={(e) => updateConfig(currentConfig.id, { systemPrompt: e.target.value })}
                className={`font-mono text-sm transition-all duration-200 ${
                  isSystemPromptExpanded 
                    ? "min-h-[200px]" 
                    : "min-h-[120px] max-h-[120px] overflow-hidden"
                }`}
                placeholder="Enter system prompt..."
              />
              {!isSystemPromptExpanded && (
                <>
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsSystemPromptExpanded(true)}
                          className="absolute bottom-1 right-1 h-6 w-6 bg-background/80 hover:bg-background border shadow-sm"
                        >
                          <ChevronDownIcon className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Expand</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
              {isSystemPromptExpanded && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSystemPromptExpanded(false)}
                        className="absolute top-1 right-1 h-6 w-6 bg-background/80 hover:bg-background border shadow-sm"
                      >
                        <ChevronUpIcon className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Collapse</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          <div className="space-y-4 pb-6 px-4">
            <Label className="text-base">Tools</Label>

            <div className="space-y-2 ">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Preconfigured Tools</Label>
              </div>
              {toolsToRender.length > 0 && (
                <div className="space-y-2 mt-3">
                  {toolsToRender.map(([toolName, spec]) => {
                    const actionRubrics = usePiJudge ? getLatestRubricsByAction(toolName) : new Map()

                    return (
                      <Card key={toolName} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 justify-between mb-2">
                              <h3 className="font-medium text-sm truncate">{toolName}</h3>
                              <Switch checked={currentConfig.toolSlugs.includes(toolName as (keyof typeof AVAILABLE_TOOLS))} onCheckedChange={(checked) => handleToggleTool(toolName, !checked)} />
                            </div>
                            <div className={'text-sm text-gray-600'}>
                              {spec.description}
                            </div>
                            {usePiJudge && (
                              <div className="space-y-2">
                                {actionRubrics.size > 0 ? (
                                  <>
                                    <p className="text-xs text-muted-foreground font-medium">Reinforced by</p>
                                    <div className="space-y-2">
                                      {Array.from(actionRubrics.entries()).map(([toolName, rubrics]) => (
                                        <div key={toolName} className="space-y-1">
                                          <p className="text-xs font-mono text-foreground/80">{toolName}</p>
                                          <div className="flex flex-wrap gap-1.5">
                                            {rubrics.call && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200"
                                              >
                                                Call v{rubrics.call.version}
                                              </Badge>
                                            )}
                                            {rubrics.result && (
                                              <Badge
                                                variant="outline"
                                                className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 border-orange-200"
                                              >
                                                Result v{rubrics.result.version}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-xs text-muted-foreground">No rubrics configured</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Add extra tools by cloning the repo and modifying <a href="https://github.com/withpi/Pi-Agent-Builder/blob/main/lib/tools.ts" target="_blank" rel="noopener noreferrer" className="hover:underline text-primary">tools.ts</a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isCustomEndpointModalOpen} onOpenChange={setIsCustomEndpointModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Your Own Inference Endpoint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="custom-endpoint">API Endpoint</Label>
              <Input
                id="custom-endpoint"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                placeholder="https://api.example.com/v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-api-key">API Key</Label>
              <Input
                id="custom-api-key"
                type="password"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="Enter your API key"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCustomEndpointModalOpen(false)}>
                Cancel
              </Button>
              <Button disabled>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
