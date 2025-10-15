'use client'
import {Code} from "lucide-react";
import {CodeSnippetModal} from "@/components/code-snippet-modal";
import {useState} from "react";
import {CODE_SNIPPETS} from "@/lib/codeSnippets";
import uiPreviewImage from '@/public/uipreview.png';
import Image from 'next/image';
import {Prism as SyntaxHighlighter} from "react-syntax-highlighter";
import {vscDarkPlus} from "react-syntax-highlighter/dist/esm/styles/prism";
import Link from "next/link";
import {Badge} from "@/components/ui/badge";

const integrationCode = `pnpm dev
# or
npm run dev`
export function AboutSection({demoLink} : {demoLink: string}) {
  const [openCodeModal, setOpenCodeModal] = useState<string | null>(null)
  return (
    <>
      <div className="max-w-4xl mx-auto space-y-12">
        <div className={'flex justify-between'}>
          <div>
            <div className={'text-3xl font-semibold'}>Pi Agent Builder Demo</div>
            <div className={'text-gray-600 mt-2'}>
              Get started with online RL agents in seconds
            </div>
          </div>
          <div className={'pt-4'}>
            <Link href={demoLink} className={'p-6 py-4 bg-black hover:bg-zinc-700 text-white font-semibold rounded-md'}>
              View Demo
            </Link>
          </div>
        </div>
        <div className={'border rounded-xl overflow-hidden'}>
          <Image alt={"Ui Preview Image"} src={uiPreviewImage}/>
        </div>
        <div className={'grid grid-cols-3 gap-12'}>
          <div className={'space-y-2 col-span-2'}>
            <div className={'font-semibold text-2xl'}>Getting started</div>
            <div className={'text-lg text-gray-600'}>First run the development server:</div>
            <div className={'my-4'}>
              <SyntaxHighlighter

                language="bash"
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  lineHeight: '1.5',
                }}
                showLineNumbers={true}
              >
                {integrationCode}
              </SyntaxHighlighter>
            </div>
            <div className={'text-lg text-gray-600'}>
              Open <span className={'text-blue-600'}>http://localhost:3000</span> with your browser to see the result.
            </div>
            <div className={'text-lg text-gray-600'}>
              You can edit accessible tools by modifying <span className={'font-mono text-sm p-0.5 bg-gray-50 px-1'}>lib/tools.ts</span>
            </div>
          </div>
          <div className={'space-y-6'}>
            <div className={'space-y-2'}>
              <div className={'font-semibold text-lg'}>Github Repo</div>
              <Link className={'font-semibold text-blue-600'} href={'https://github.com/withpi/Pi-Agent-Builder'}>
                withpi/Pi-Agent-Builder
              </Link>
            </div>
            <div className={'space-y-2 flex flex-col'}>
              <div className={'font-semibold text-lg'}>Use Cases</div>
              <Badge variant={'outline'}>
                Guardrail Enforcement
              </Badge>
              <Badge  variant={'outline'}>
                Code Generation
              </Badge>
              <Badge variant={'outline'}>
                Starter template
              </Badge>
            </div>
          </div>
        </div>
        {/* Part 1: Give your agent feedback */}
        <div className="flex gap-8 items-center">
          <div className="flex-[0.6] aspect-video rounded-lg overflow-hidden">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/a3pyUJfpI0k"
              title="Give your agent feedback"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          </div>
          <div className="flex-1 space-y-4">
            <h2 className="text-xl font-bold">Give your agent feedback. Watch that turn into judges</h2>
            <p className="text-muted-foreground text-lg">
              Annotate your agent's traces with your feedback. Highlight what works well and what needs
              improvement. Your insights become the foundation for making your agent better.
            </p>
            <button
              onClick={() => setOpenCodeModal("feedback")}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Code className="w-4 h-4" />
              See the code
            </button>
          </div>
        </div>

        {/* Part 2: Your feedback turns into evaluations */}
        <div className="flex gap-8 items-center">
          <div className="flex-[0.6] aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed relative">
            <div className="absolute inset-0 bg-black bg-opacity-20 rounded-lg"></div>
            <div className="text-center space-y-2 relative z-10">
              <svg
                className="w-12 h-12 mx-auto text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-muted-foreground text-sm font-medium">Coming Soon</p>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <h2 className="text-xl font-bold">Use Pi Judge to evaluate and compare agents</h2>
            <p className="text-muted-foreground text-lg">
              Pi automatically converts your feedback into evaluation judges. These judges continuously measure
              your agent's performance, giving you clear metrics on what's working and what's not.
            </p>
            <button
              onClick={() => setOpenCodeModal("evaluate")}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Code className="w-4 h-4" />
              See the code
            </button>
          </div>
        </div>

        {/* Part 3: Your feedback improves your agent */}
        <div className="flex gap-8 items-center">
          <div className="flex-[0.6] aspect-video rounded-lg overflow-hidden">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/VXEdSjYojM0"
              title="Use Pi Judge to align your agent"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          </div>
          <div className="flex-1 space-y-4">
            <h2 className="text-xl font-bold">Use Pi Judge to align your agent</h2>
            <p className="text-muted-foreground text-lg">
              Your feedback becomes actionable improvements. Pi uses your insights to generate online controls and
              refinements that make your agent smarter and more reliable over time.
            </p>
            <button
              onClick={() => setOpenCodeModal("align")}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Code className="w-4 h-4" />
              See the code
            </button>
          </div>
        </div>
      </div>

      {/* Code Modals */}
      <CodeSnippetModal
        open={openCodeModal === "feedback"}
        onOpenChange={(open) => !open && setOpenCodeModal(null)}
        title="Give Feedback - Code Example"
        description="Here's how to annotate your agent's traces with feedback"
        code={CODE_SNIPPETS.feedback}
        fileName="components/step-card.tsx"
        githubUrl="https://github.com/withpi/Pi-Agent-Builder/blob/main/components/step-card.tsx"
      />

      <CodeSnippetModal
        open={openCodeModal === "evaluate"}
        onOpenChange={(open) => !open && setOpenCodeModal(null)}
        title="Evaluate Agents - Code Example"
        description="Here's how to use Pi Judge to evaluate and compare agents"
        code={CODE_SNIPPETS.evaluate}
        fileName="lib/agent-context.tsx"
        githubUrl="https://github.com/withpi/Pi-Agent-Builder/blob/main/lib/agent-context.tsx"
      />

      <CodeSnippetModal
        open={openCodeModal === "align"}
        onOpenChange={(open) => !open && setOpenCodeModal(null)}
        title="Align Your Agent - Code Example"
        description="Here's how to use Pi Judge to create alignment controls"
        code={CODE_SNIPPETS.align}
        fileName="app/api/agent/run/route.ts"
        githubUrl="https://github.com/withpi/Pi-Agent-Builder/blob/main/app/api/agent/run/route.ts"
      />
    </>
  )
}