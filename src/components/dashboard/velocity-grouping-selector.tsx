"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"

type Grouping = "week" | "month" | "all"

const options: { value: Grouping; label: string }[] = [
    { value: "week", label: "Semaine" },
    { value: "month", label: "Mois" },
    { value: "all", label: "Période Globale" },
]

export function VelocityGroupingSelector({ currentGrouping }: { currentGrouping: Grouping }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    function handleClick(value: Grouping) {
        const params = new URLSearchParams(searchParams.toString())
        if (value === "all") {
            params.delete("grouping")
        } else {
            params.set("grouping", value)
        }
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
