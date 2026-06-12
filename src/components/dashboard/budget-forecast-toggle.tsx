"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"

export function BudgetForecastToggle({ currentForecast }: { currentForecast: boolean }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    function handleToggle() {
        const params = new URLSearchParams(searchParams.toString())
        if (currentForecast) {
            params.delete("forecast")
        } else {
            params.set("forecast", "true")
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="flex items-center gap-3">
            <button
                onClick={handleToggle}
                role="switch"
                aria-checked={currentForecast}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 focus-visible:outline-none ${
                    currentForecast
                        ? "bg-primary border-primary/80"
                        : "bg-muted border-muted-foreground/30"
                }`}
            >
                <span
                    className={`pointer-events-none inline-block h-4 w-4 mt-0.5 transform rounded-full shadow-lg ring-0 transition-transform duration-200 ${
                        currentForecast
                            ? "translate-x-5 bg-white"
                            : "translate-x-0.5 bg-muted-foreground/60"
                    }`}
                />
            </button>
            <span className={`text-xs font-medium transition-colors ${currentForecast ? "text-foreground" : "text-muted-foreground"}`}>
                Voir prévisionnel futur
            </span>
        </div>
    )
}
