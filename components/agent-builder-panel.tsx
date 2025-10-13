"use client"

import { useState, useEffect } from "react"
import { AgentConfiguration } from "./agent-configuration"
import { AgentConversation } from "./agent-conversation"
import { useAgent } from "@/lib/agent-context"

export function AgentBuilderPanel({
  pendingConfigLoad,
  onConfigLoaded,
}: {
  pendingConfigLoad?: { configId: string; input: string } | null
  onConfigLoaded?: () => void
}) {
  const { currentConfig, setCurrentConfig, rubrics, configs } = useAgent()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [usePiJudge, setUsePiJudge] = useState(true)
  const [pendingInput, setPendingInput] = useState<string | null>(null)

  useEffect(() => {
    if (pendingConfigLoad) {
      const configToLoad = configs.find((c) => c.id === pendingConfigLoad.configId)
      if (configToLoad) {
        setCurrentConfig(configToLoad)
        setUsePiJudge(configToLoad.usePiJudge || false)
        setPendingInput(pendingConfigLoad.input)
        onConfigLoaded?.()
      }
    }
  }, [pendingConfigLoad, configs, setCurrentConfig, onConfigLoaded])

  return (
    <div className="flex h-full overflow-hidden">
      <AgentConfiguration
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        usePiJudge={usePiJudge}
        onUsePiJudgeChange={setUsePiJudge}
      />
      <AgentConversation
        usePiJudge={usePiJudge}
        rubrics={rubrics}
        isConfigCollapsed={isCollapsed}
        onToggleConfig={() => setIsCollapsed(!isCollapsed)}
        pendingInput={pendingInput}
        onInputLoaded={() => setPendingInput(null)}
      />
    </div>
  )
}
