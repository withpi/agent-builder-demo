# Pi Agent Builder

**Pi Agent Builder** allows users to build **reinforced LLM agents** using **Pi Judges** and a set of preconfigured tools.
It’s a simple, extensible framework for experimenting with **alignment-guided AI agents** that can browse the web, evaluate content, and improve over time using preference feedback.

---

## 🚀 Overview

Pi Agent Builder demonstrates how **aligned AI judges** can be used to **steer autonomous agents** online and improve the quality of their reasoning, actions, and outputs.

Using **Pi Labs** scoring models, users can transform just a few human ratings into **automatic preference enforcement** — turning simple feedback into consistent behavioral improvements.

This repository is fully **open source** and serves as a **template** for anyone looking to build agents that can be easily steered with a small amount of preference data.
You can quickly create **any type of agent** by editing `/lib/tools.ts` to add, remove, or customize tools.

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
   git clone https://github.com/yourusername/pi-agent-builder.git
   cd pi-agent-builder
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
