"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Play, Square } from "lucide-react"

interface ConversationInputProps {
  onConfirm: (input: string) => void
  isRunning: boolean
  onStop: () => void
  initialValue?: string
  disabled?: boolean
}

export function ConversationInput({
  onConfirm,
  isRunning,
  onStop,
  initialValue = "",
  disabled = false,
}: ConversationInputProps) {
  const [input, setInput] = useState(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Update local state when initialValue changes
  useEffect(() => {
    if (initialValue !== input) {
      setInput(initialValue)
    }
  }, [initialValue])

  const handleSubmit = () => {
    if (!input.trim() || disabled || isRunning) return
    onConfirm(input.trim())
    // Don't clear the input here - let the parent decide
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex gap-2">
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Press Enter to send, Shift+Enter for new line"
        className="min-h-[60px] resize-none"
        onKeyDown={handleKeyDown}
        disabled={disabled || isRunning}
      />
      <div className="flex flex-col gap-2">
        <Button 
          onClick={handleSubmit} 
          disabled={isRunning || !input.trim() || disabled} 
          className="gap-2"
        >
          <Play className="w-4 h-4" />
          Start
        </Button>
        <Button 
          onClick={onStop} 
          disabled={!isRunning} 
          variant="destructive" 
          className="gap-2"
        >
          <Square className="w-4 h-4" />
          Stop
        </Button>
      </div>
    </div>
  )
}
