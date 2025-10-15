export const CODE_SNIPPETS = {
  feedback: `// How feedback is organized in Pi Agent Builder
// Each feedback captures the step's input and output context

// Example: Submitting feedback for an ACTION step (tool call)
const handleFeedbackSubmit = async () => {
  const stepIndex = currentTrace.steps.findIndex((s) => s.id === step.id)
  const precedingSteps = currentTrace.steps.slice(0, stepIndex)
  
  // Use prepareActionFromSteps to split input/output
  const scoringData = await prepareActionFromSteps(
    precedingSteps,
    step.toolName,
    step.toolInput,
    currentTrace.input
  )
  
  // scoringData contains:
  // - input: Messages before the tool call (excluding parallel calls)
  // - output: { toolName, toolInput }
  
  await addFeedback(traceId, step.id, {
    stepType: "ACTION",
    toolName: step.toolName,
    rating: "up" | "down",
    description: "Your feedback here",
    input: scoringData.input,    // Context before action
    output: scoringData.output    // Tool call details
  })
}

// Similar patterns for other step types:
// - prepareResponseFromSteps(query, response)
// - prepareThinkingFromSteps(precedingSteps, thinking, input)
// - prepareObservationFromSteps(toolName, toolInput, toolOutput)`,
  evaluate: `// How Pi Agent Builder evaluates steps with rubrics
// The scoreStep function scores any step against its rubric

const scoreStep = async (
  step: AgentStep, 
  trace: AgentTrace, 
  rubric?: Rubric
): Promise<StepScore | null> => {
  // 1. Find the appropriate rubric for this step type
  let targetRubric = rubric
  if (!targetRubric) {
    if (step.type === "RESPONSE") {
      const rubrics = getRubricsByStepType("RESPONSE")
      targetRubric = rubrics[rubrics.length - 1]
    } else if (step.type === "ACTION" && step.toolName) {
      const rubrics = getRubricsByToolNameAndType(step.toolName, "tool-call")
      targetRubric = rubrics[rubrics.length - 1]
    }
    // ... similar for THINKING and OBSERVATION
  }

  if (!targetRubric || targetRubric.questions.length === 0) {
    return null
  }

  // 2. Prepare input/output context for scoring
  const precedingSteps = trace.steps.filter(
    (s) => s.timestamp <= step.timestamp && s.id !== step.id
  )

  let scoringData
  if (step.type === "ACTION") {
    scoringData = await prepareActionFromSteps(
      precedingSteps, 
      step.toolName!, 
      step.toolInput, 
      trace.input
    )
  }
  // ... similar for other step types

  // 3. Score against rubric questions
  const scoredData = await getScoredData([scoringData], targetRubric.questions)

  // 4. Return structured score with question breakdown
  return {
    rubricId: targetRubric.id,
    total: scoredData[0].score,
    questionScores: scoredData[0].questionScores.map(qs => ({
      label: qs.label,
      question: targetRubric.questions.find(q => q.label === qs.label)?.question || "",
      score: qs.score,
    })),
    timestamp: Date.now(),
  }
}`,
  align: `// How Pi Agent Builder steers the model based on step scores
// The prepareStep hook runs before each model call to inject feedback

prepareStep: async ({ steps, stepNumber, messages }) => {
  const lastStep = steps[steps.length - 1]
  const failedChecks = []

  // 1. Score the last step against its rubric
  if (lastStep.toolCalls) {
    for (const toolCall of lastStep.toolCalls) {
      const rubric = rubricsByToolCall.get(toolCall.toolName)
      if (rubric) {
        const scoringData = prepareActionFromMessages(
          messagesBeforeToolCall, 
          toolCall.toolName, 
          toolCall.input
        )
        const scoredData = await getScoredData([scoringData], rubric.questions)
        const threshold = rubric.threshold || 0.5

        // 2. If score below threshold, collect failed criteria
        if (scoredData[0].score < threshold) {
          const lowScoringCriteria = scoredData[0].questionScores
            .filter(qs => qs.score < threshold)
            .map(qs => {
              const question = rubric.questions.find(q => q.label === qs.label)
              return \`  - \${question?.question}: \${Math.round(qs.score * 100)}%\`
            })

          failedChecks.push({
            toolName: toolCall.toolName,
            score: scoredData[0].score,
            threshold,
            lowScoringCriteria
          })
        }
      }
    }
  }

  // 3. If checks failed, inject corrective feedback into messages
  if (failedChecks.length > 0) {
    const feedbackMessage = \`🚫 STOP - YOUR LAST ACTION WAS REJECTED

The system blocked your step because it failed quality standards.

**Quality gaps identified:**
\${failedChecks[0].lowScoringCriteria.join('\\n')}

**YOU MUST DO THIS NOW:**
1. Review each quality gap above
2. Understand WHY each criterion failed
3. Revise your approach to address EVERY failed criterion
4. Re-execute the corrected action

DO NOT proceed with different actions. RETRY with corrections.\`

    // Inject feedback as a user message to steer the model
    return { 
      messages: [...messages, { 
        role: 'user', 
        content: feedbackMessage 
      }] 
    }
  }

  return { messages }
}`,
}
