import {AgentBuilder} from "@/components/agent_builder";
import {auth} from "@/auth";


export default async function Page() {
  const session = await auth();
  return <AgentBuilder user={session?.user}/>
}