import {AboutSection} from "@/components/about_section";
import {Navbar} from "@/components/navbar";
import {Footer} from "@/components/footer";
import {headers} from "next/headers";
import {auth} from "@/auth";

const AUTH_HOST = process.env.AUTH_HOST || 'withpi.ai'

export default async function AboutPage() {
  const allHeaders = await headers();
  const session = await auth();
  const hostName = allHeaders.get('host');
  const host = hostName?.startsWith('localhost') ? `http://${hostName}` : `https://${hostName}`
  const queryParams = new URLSearchParams({
    callbackUrl: host
  })
  const redirectUrl = session?.user?.email ? '/demo' : `${AUTH_HOST.startsWith('localhost') ? 'http://' : 'https://'}${AUTH_HOST}/login?${queryParams}`
  return (
    <div className={'bg-gray-50'}>
      <Navbar user={session?.user}/>
      <div className={'py-16 px-4 pb-24'}>
        <AboutSection demoLink={redirectUrl}/>
      </div>
      <Footer/>
    </div>
  )
}