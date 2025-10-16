"use client"

import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MemoizedMarkdownProps {
  content: string
  className?: string
  isStreaming?: boolean
}

export const MemoizedMarkdown = memo(function MemoizedMarkdown({ 
  content, 
  className = "text-sm prose prose-sm max-w-none dark:prose-invert prose-table:text-sm prose-th:p-2 prose-td:p-2",
  isStreaming = false 
}: MemoizedMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
      {isStreaming && <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />}
    </div>
  )
})
