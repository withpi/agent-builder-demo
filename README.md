# Pi Agent Builder

**Try the live demo →** *(link coming soon)*

**Pi Agent Builder** allows users to build **reinforced LLM agents** using **[Pi Judges](https://code.withpi.ai/score/writing_rubrics)** and a set of preconfigured tools.

Turn your natural language feedback into distilled principles that deterministically guide your agent — not only to evaluate different configurations (system prompt, model, tools...), but also to establish guardrails for real-time self-correction.

This repository is fully **open source** and serves as a **template** for building easily steerable agents.

---

## 🚀 Overview

As teams debug agent traces, observations, rules, and edge cases pile up — **you can't fit all of that into a system prompt**. Teams also shouldn't need to invest in the expensive process of **writing and rewriting "LLM-as-a-judge" prompts** every time they discover a new failure mode.

**Pi provides an alternative architecture**: instead of prescribing everything upfront in a prompt, equip your agent with principles it can lean on to course-correct at execution time. **Just provide feedback when you find issues, and Pi turns that into judges** — automatically annotating problems across all traces and enabling self-correction.

**[Pi Judges](https://code.withpi.ai/score/writing_rubrics)** transform your feedback into automatic preference enforcement, allowing you to:
* **Evaluate** different agent configurations to find what works best
* **Enforce and self-correct** — establish guardrails that maintain consistent behavior and allow agents to course-correct in real-time when they drift

This framework is fully **extensible** — quickly create any type of agent by editing `/lib/tools.ts` to add, remove, or customize tools.

---


## 📹 See How It Works

- [**Pi Turns your Feedback into Judges**](https://youtu.be/a3pyUJfpI0k)
- [**Your Judges help your agent self-heal**](https://youtu.be/VXEdSjYojM0)

---

## 🧠 Core Concepts

* **Reinforced Agents** – LLM agents guided by Pi Judges for preference-aligned behavior.
* **Judges (Pi Scoring Models)** – Tunable evaluators that enforce user preferences automatically.
* **Configurable Tools** – Modular capabilities such as web browsing and content retrieval, defined in [`/lib/tools.ts`](./lib/tools.ts).
* **Web Integration** – Preconfigured with [Exa AI](https://exa.ai/) for enabling browsing and web page viewing.
* **Template Design** – Start from this project to build **custom agents** that fit your specific use case.

---

## 🔑 Environment Setup

This project requires the following API keys. Add them to your `.env.local` file:

```bash
WITHPI_API_KEY=<your_withpi_key>   # https://withpi.ai/account/keys
EXA_API_KEY=<your_exa_key>         # https://exa.ai/
OPENAI_API_KEY=<your_openai_key>   # https://openai.com/
```

---

## 🧩 Configuration

All tools used by the agent are defined in:

```
/lib/tools.ts
```

You can easily add, remove, or modify tools to extend the agent’s capabilities.

Example tools include:

* Web search (Exa AI)
* Web page summarization
* Custom evaluation or scoring functions

By editing this file, you can quickly prototype **different kinds of agents** — from research assistants to data retrievers to preference-enforcing copilots.

---

## ⚡ Quick Customization Example

Here’s a real example of how tools are defined in `/lib/tools.ts` — and how to add your own.

```ts
import { tool } from "ai";
import { z } from "zod";
import { getFullWebContent, searchWebResults } from "@/lib/toolActions/searchActions";

export const AVAILABLE_TOOLS = {
  // Example: Search the web using Exa AI
  search_web_results: tool({
    description: "Search the internet for up-to-date website sources relevant to a query",
    inputSchema: z.object({
      query: z.string().describe("The search query to search the web for"),
      maxResults: z.number().optional().describe("Maximum number of results to return (default: 2)"),
    }),
    execute: async ({ query, maxResults = 2 }) => {
      try {
        console.log("[v0] Executing search_web_results with query:", query);
        return await searchWebResults(query, maxResults);
      } catch (error) {
        console.error("[v0] Tool execution error:", error);
        return { error: "Search failed", results: [] };
      }
    },
  }),

  // Example: Get the contents of a website
  get_website_content: tool({
    description: "Retrieve the full contents of a website link",
    inputSchema: z.object({
      url: z.string().describe("The URL of the website to visit"),
    }),
    execute: async ({ url }) => {
      try {
        console.log("[v0] Executing get_website_content with URL:", url);
        return await getFullWebContent(url);
      } catch (error) {
        console.error("[v0] Tool execution error:", error);
        return { error: "Content fetch failed" };
      }
    },
  }),

  // 👇 Add your own custom tool here
  summarize_text: tool({
    description: "Summarize a block of text using OpenAI",
    inputSchema: z.object({
      text: z.string().describe("The text to summarize"),
    }),
    execute: async ({ text }) => {
      console.log("[v0] Summarizing text:", text.slice(0, 50));
      // Example: call your LLM here
      const summary = `Summary of text: ${text.substring(0, 100)}...`;
      return { summary };
    },
  }),
} as const;
```

Once you add a new tool, it’s instantly available to the agent without further configuration.

---

## 🧪 Usage

1. Clone the repository:

   ```bash
   git clone https://github.com/withpi/Pi-Agent-Builder
   cd Pi-Agent-Builder
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   pnpm install
   ```

3. Add your `.env.local` file with the required keys.

4. Start the app:

   ```bash
   npm run dev
   ```

---

## 🧭 Purpose

Pi Agent Builder is designed to illustrate how **preference alignment** can guide agentic systems.
Instead of relying purely on raw LLM output, **Pi Judges** provide a feedback-driven reinforcement layer that makes agent behavior **more consistent**, **reliable**, and **steerable**.

---

## 🧩 About Pi Labs

[**Pi Labs**](https://withpi.ai) builds **tunable scoring and ranking models** that reinforce LLMs and search systems.
Unlike standard LLMs, Pi’s models are:

* **More consistent** across runs
* **Easier to tune** with preference data
* **Designed for alignment and quality control**

Pi Labs models can be used to enforce preferences, evaluate responses, or improve the reliability of generative systems through reinforcement.

---

## 📄 License

This repository is open source and available under the [MIT License](./LICENSE).
