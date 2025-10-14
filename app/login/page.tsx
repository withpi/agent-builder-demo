import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from "next/link"
import { auth } from "@/auth"

const AUTH_HOST = process.env.AUTH_HOST || 'https://withpi.ai'
const HOST = process.env.HOST || process.env.NEXTAUTH_URL || 'http://localhost:3000'

export default async function LoginPage() {
  const session = await auth()
  console.log(session)

  const queryParams = new URLSearchParams({
    redirectTo: HOST
  })
  const redirectUrl = `${AUTH_HOST}/login?${queryParams}`

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to Agent Builder Demo</CardTitle>
          <CardDescription>
            Sign in with your Pi Account to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              To use this demo, you need a <strong>Pi Account</strong>. If you don't have one yet, 
              you can create an account during the login process.
            </p>
          </div>
          <Button asChild className="w-full" size="lg">
            <Link href={redirectUrl}>
              Login with Pi
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
