import type { GenerateScorerUserMessage } from "@/lib/rubric/rubricActions"
import { CheckIcon } from "@heroicons/react/24/outline"
import { ProgressCircle } from "@/components/tremor/progress_circle"

export function GenerateScorerStatusIcon({
  status,
  isLast,
  className,
}: {
  status: GenerateScorerUserMessage
  isLast: boolean
  className?: string
}) {
  if (isLast) {
    if (typeof status.completion === "number") {
      if (status.completion == 1) {
        return (
          <div className={className || "pt-2"}>
            <CheckIcon className={"w-5 text-green-600"} />
          </div>
        )
      } else {
        return (
          <div className={className || "pt-2.5"}>
            <ProgressCircle className="size-4" strokeWidth={12} value={status.completion * 100} showAnimation />
          </div>
        )
      }
    } else {
      return (
        <div className={className || "pt-2.5"}>
          <ProgressCircle className="size-4 animate-spin" strokeWidth={12} value={30} />
        </div>
      )
    }
  } else {
    return (
      <div className={className || "pt-2"}>
        <CheckIcon className={"w-5 text-green-600"} />
      </div>
    )
  }
}
