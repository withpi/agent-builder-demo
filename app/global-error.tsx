"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Something went wrong!</h1>
              <p className="text-muted-foreground">
                A global error occurred. Please try refreshing the page.
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 text-left">
              <p className="text-sm font-mono text-muted-foreground">
                {error.message || "Unknown error occurred"}
              </p>
              {error.digest && (
                <p className="text-xs text-muted-foreground mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
            
            <div className="flex gap-2 justify-center">
              <button 
                onClick={reset}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Try again
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 border border-input bg-background rounded-md hover:bg-accent"
              >
                Refresh page
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
