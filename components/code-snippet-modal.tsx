"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeSnippetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  code: string
  fileName?: string
}

export function CodeSnippetModal({ open, onOpenChange, title, description, code, fileName }: CodeSnippetModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {fileName && (
            <div className=" text-sm font-mono text-muted-foreground bg-muted px-4 py-2 rounded-t-lg border-b">
              {fileName}
            </div>
          )}
          <SyntaxHighlighter
            language="typescript"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              borderRadius: fileName ? '0 0 0.5rem 0.5rem' : '0.5rem',
              fontSize: '0.875rem',
              lineHeight: '1.5',
            }}
            showLineNumbers={true}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

