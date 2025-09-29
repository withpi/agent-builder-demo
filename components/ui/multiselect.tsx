"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface MultiselectOption {
  value: string
  label: string
  category?: string
}

interface MultiselectProps {
  options: MultiselectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  className?: string
}

export function Multiselect({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select options...",
  className = ""
}: MultiselectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Group options by category
  const groupedOptions = options.reduce((acc, option) => {
    const category = option.category || "Other"
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(option)
    return acc
  }, {} as Record<string, MultiselectOption[]>)

  // Filter options based on search term
  const filteredGroupedOptions = Object.entries(groupedOptions).reduce((acc, [category, options]) => {
    const filtered = options.filter(option => 
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.value.toLowerCase().includes(searchTerm.toLowerCase())
    )
    if (filtered.length > 0) {
      acc[category] = filtered
    }
    return acc
  }, {} as Record<string, MultiselectOption[]>)

  const selectedOptions = options.filter(option => value.includes(option.value))

  const handleToggle = (optionValue: string) => {
    if (optionValue === "all") {
      // Special handling for "all" option
      if (value.includes("all")) {
        // If "all" is currently selected, deselect it (clear all selections)
        onChange([])
      } else {
        // If "all" is not selected, select only "all"
        onChange(["all"])
      }
    } else {
      // Regular option handling
      if (value.includes(optionValue)) {
        const newValue = value.filter(v => v !== optionValue)
        // If we're removing the last option, default to "all"
        if (newValue.length === 0) {
          onChange(["all"])
        } else {
          onChange(newValue)
        }
      } else {
        // If we're adding an option and "all" is currently selected, remove "all" first
        const newValue = value.includes("all") 
          ? [optionValue] 
          : [...value, optionValue]
        onChange(newValue)
      }
    }
  }

  const handleSelectAll = () => {
    onChange(["all"])
  }

  const handleSelectNone = () => {
    onChange(["all"])
  }

  const handleRemove = (optionValue: string) => {
    if (optionValue === "all") {
      // If removing "all", clear all selections
      onChange([])
    } else {
      const newValue = value.filter(v => v !== optionValue)
      // If we're removing the last option, default to "all"
      if (newValue.length === 0) {
        onChange(["all"])
      } else {
        onChange(newValue)
      }
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm("")
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between min-h-[40px] h-auto"
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {selectedOptions.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selectedOptions.map(option => (
              <Badge
                key={option.value}
                variant="secondary"
                className="text-xs"
              >
                {option.label}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(option.value)
                  }}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </Button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              type="text"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          
          <div className="p-1">
            <div className="flex gap-1 mb-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSelectAll}
                className="text-xs h-6 px-2"
              >
                Select All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSelectNone}
                className="text-xs h-6 px-2"
              >
                Clear All
              </Button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {Object.entries(filteredGroupedOptions).map(([category, categoryOptions]) => (
              <div key={category}>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                  {category}
                </div>
                {categoryOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleToggle(option.value)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center gap-2"
                  >
                    <div className={`w-4 h-4 border border-border rounded flex items-center justify-center ${
                      value.includes(option.value) ? "bg-primary border-primary" : ""
                    }`}>
                      {value.includes(option.value) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="flex-1">{option.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
