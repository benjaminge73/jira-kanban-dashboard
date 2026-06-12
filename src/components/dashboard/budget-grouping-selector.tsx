"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"

type BudgetGrouping = "week" | "month"

const options: { value: BudgetGrouping; label: string }[] = [
    { value: "month", label: "Mois" },
    { value: "week", label: "Semaine" },
]

export function BudgetGroupingSelector({ currentGrouping }: { currentGrouping: BudgetGrouping }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    function handleClick(value: BudgetGrouping) {
        const params = new URLSearchParams(searchParams.toString())
        params.set("view", value)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    return (
        <div className="flex gap-1 bg-muted rounded-lg p-1">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => handleClick(opt.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${currentGrouping === opt.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    )
}
