"use client"

// Global error boundary. In live mode the most likely failure is an unreachable
// or misconfigured Jira instance, so the hint focuses on that. Kept free of
// i18n/context dependencies — it can render when providers are broken.

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    return (
        <div className="flex h-full min-h-[60vh] items-center justify-center p-8">
            <div
                className="max-w-lg rounded-xl border bg-card p-8 text-center space-y-4"
                style={{ borderColor: "rgba(0,212,255,0.2)" }}
            >
                <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
                <p className="text-sm text-muted-foreground">
                    {error.message || "An unexpected error occurred while loading data."}
                </p>
                <p className="text-xs text-muted-foreground/70">
                    If the app is running in live mode, make sure the Jira instance is reachable
                    and the <code className="font-mono">JIRA_*</code> environment variables are
                    correct. Details are available in the server logs.
                </p>
                <button
                    onClick={reset}
                    className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                    Retry
                </button>
            </div>
        </div>
    )
}
