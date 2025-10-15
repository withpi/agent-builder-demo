'use client';

import {useState} from "react";
import {AgentProvider} from "@/lib/agent-context";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {AgentBuilderPanel} from "@/components/agent-builder-panel";
import {RubricBuilderPanel} from "@/components/rubric-builder-panel";
import {EvaluateAgentPanel} from "@/components/evaluate-agent-panel";
import {Navbar} from "@/components/navbar";

export function AgentBuilder() {
  const [activeTab, setActiveTab] = useState("build-agent")
  const [pendingConfigLoad, setPendingConfigLoad] = useState<{ configId: string; input: string; traceId?: string } | null>(null)
  return (
    <AgentProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 overflow-hidden flex-col">
          <Navbar>
            <TabsList>
              <TabsTrigger value="build-agent">Build Agent</TabsTrigger>
              <TabsTrigger value="build-judges">Build Pi Judges</TabsTrigger>
              <TabsTrigger value="evaluate-agent">Evaluate Agent</TabsTrigger>
            </TabsList>
          </Navbar>
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
              onLoadConfigAndInput={(configId: string, input: string, traceId?: string) => {
                setPendingConfigLoad({ configId, input, traceId })
                setActiveTab("build-agent")
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AgentProvider>
  )
}
