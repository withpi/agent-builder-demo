"use client"

import {
  cancelGenerateScorerJob,
  createRubric,
  type GenerateScorerJobStatus,
  retrieveGenerateScorerJob,
  type RubricExample, // Import the new type
} from "@/lib/rubric/rubricActions"
import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import PiClient from "withpi";
import Question = PiClient.Question;

export type RubricGenerator = {
  status?: GenerateScorerJobStatus | null
  running: boolean
  error: any
  start: (
    appDesc: string,
    goodExamples: RubricExample[],
    badExamples: RubricExample[],
    existingRubric?: Question[],
  ) => Promise<GenerateScorerJobStatus>
  cancel: () => Promise<string>
  reset: () => Promise<void>
}

export function useRubricGenerator({
                                     initJobId = null,
                                     onFetch = () => {},
                                     onFinish = () => {},
                                     onError = () => {},
                                   }: {
  initJobId: string | null
  onFetch?: (status: GenerateScorerJobStatus) => void
  onFinish?: (status: GenerateScorerJobStatus) => void
  onError?: (err: any) => void
}): RubricGenerator {
  const [jobId, setJobId] = useState<string | null>(initJobId)
  const [running, setRunning] = useState<boolean>(false)
  const [shouldPoll, setShouldPoll] = useState<boolean>(true)
  const finishDidRun = useRef(false)
  useEffect(() => {
    if (jobId) {
      finishDidRun.current = false
    }
  }, [jobId])
  const {
    data: status,
    error,
    mutate,
  } = useSWR(
    () => (jobId ? `/sdk/scoring_system/generate/${jobId}` : null),
    async () => {
      if (jobId) {
        console.log("Finish did run", finishDidRun.current)
        setRunning(true)
        const jobStatus = await retrieveGenerateScorerJob(jobId)
        onFetch?.(jobStatus)
        if (jobStatus.state === "ERROR" || jobStatus.state === "CANCELLED" || jobStatus.state === "DONE") {
          if (jobStatus.state === "DONE") {
            if (!finishDidRun.current) {
              onFinish?.(jobStatus)
              finishDidRun.current = true
            }
          } else if (jobStatus.state == "ERROR") {
            if (!finishDidRun.current) {
              onError(new Error(`Failed to generate scorer: ${JSON.stringify(jobStatus)} `))
            }
          }
          setRunning(false)
          setShouldPoll(false)
        }
        return jobStatus
      }
      return null
    },
    shouldPoll ? { refreshInterval: 2000, onError } : { onError },
  )

  return {
    status,
    running,
    error,
    start: async (appDesc: string, goodExamples: RubricExample[], badExamples: RubricExample[], existingRubric?: Question[]) => {
      setRunning(true)
      setShouldPoll(true)
      const newJob = await createRubric(appDesc, existingRubric || [], goodExamples, badExamples)
      setJobId(newJob.jobId)
      return newJob
    },
    cancel: async () => {
      if (jobId) {
        setRunning(false)
        const response = await cancelGenerateScorerJob(jobId)
        setJobId(null)
        setShouldPoll(true)
        return response
      } else {
        throw new Error("Unable to cancel a job that does not exist")
      }
    },
    reset: async () => {
      setJobId(null)
      setRunning(false)
      setShouldPoll(true)
      await mutate(null)
    },
  }
}
