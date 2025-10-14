"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface CodeSnippetModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  code: string
}

export function CodeSnippetModal({ open, onOpenChange, title, description, code }: CodeSnippetModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
          <code>{code}</code>
        </pre>
      </DialogContent>
    </Dialog>
  )
}

