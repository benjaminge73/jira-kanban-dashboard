import { redirect } from "next/navigation"

// Demo mode — no login required, redirect straight to dashboard.
export default function RootPage() {
    redirect("/dashboard")
}
