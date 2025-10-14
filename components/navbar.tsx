import Link from "next/link";
import Image from "next/image";
import piLogo from "@/public/pi-logo.svg";
import {BookOpen, Calendar, Github, Mail, MessageCircle} from "lucide-react";
import {ReactNode} from "react";

export function Navbar({children} : {children: ReactNode;}) {
  return (
    <header className="flex items-center justify-between gap-6 px-6 py-4 border-b">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Link href={'https://withpi.ai'} target={'_blank'} className="flex items-center justify-center w-6 h-6 rounded-lg ">
            <Image src={piLogo} alt={"Pi Labs logo"}/>
          </Link>
          <h1 className="text-2xl font-bold">Pi Agent Builder</h1>
        </div>
        {children}
      </div>

      <div className="flex items-center gap-6">
        {/* Get in touch section */}
        <div className="flex items-center gap-3 border-r pr-6">
          <span className="text-sm font-medium text-muted-foreground">Get in touch</span>
          <a
            href="https://discord.gg/zcjXygYMe5"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
            title="Join our Discord"
          >
            <MessageCircle className="w-4 h-4" />
            Discord
          </a>
          <a
            href="https://calendar.app.google/wvGTUqNLcUberikD8"
            target="_blank"
            className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
            title="Schedule time with Pi"
            rel="noreferrer"
          >
            <Calendar className="w-4 h-4" />
            Schedule
          </a>
          <a
            href="mailto:dhruv@withpi.ai"
            className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
            title="Send us an email"
          >
            <Mail className="w-4 h-4" />
            Email
          </a>
        </div>

        {/* Use the code section */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Use the code</span>
          <a
            href="https://github.com/withpi"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
            title="View on GitHub"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
          <a
            href="https://code.withpi.ai/"
            target="_blank"
            className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
            title="Pi Documentation"
            rel="noreferrer"
          >
            <BookOpen className="w-4 h-4" />
            Docs
          </a>
        </div>
      </div>
    </header>
  )
}