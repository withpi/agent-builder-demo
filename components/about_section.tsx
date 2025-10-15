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
import {ArrowLeftIcon} from "@heroicons/react/24/outline";

const integrationCode = `pnpm dev
# or
npm run dev`
export function AboutSection() {
  const [openCodeModal, setOpenCodeModal] = useState<string | null>(null)
  return (
    <>
      <div className="max-w-4xl mx-auto space-y-12">
        <Link href={'https://withpi.ai/templates'} className={'text-sm text-gray-500 flex gap-2'}>
          <ArrowLeftIcon className={'w-3'}/> Back to Templates
        </Link>
        <div className={'flex justify-between'}>
          <div>
            <div className={'text-3xl font-semibold'}>Pi Agent Builder Demo</div>
            <div className={'text-gray-600 mt-2'}>
              Get started aligning your agent with your feedback in seconds
            </div>
          </div>
          <div className={'pt-4'}>
            <Link href={'/demo'} className={'p-6 py-4 bg-black hover:bg-zinc-700 text-white font-semibold rounded-md'}>
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
              You can edit the tools your agent can use by modifying <a
                href="https://github.com/withpi/Pi-Agent-Builder/blob/main/lib/tools.ts"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm p-0.5 bg-gray-50 px-1 text-blue-700 underline"
              >lib/tools.ts</a>
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
          <div className="flex-[0.6] aspect-video rounded-lg overflow-hidden">
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/Ex-6Hlw_MXo"
              title="Use Pi Judge to evaluate and compare agents"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            ></iframe>
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