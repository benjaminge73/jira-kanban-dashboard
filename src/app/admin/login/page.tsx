import { redirect } from "next/navigation"

// Demo mode — no login required
export default function AdminLoginPage() {
    redirect("/admin/jh")
}
