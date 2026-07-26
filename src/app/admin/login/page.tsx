import { redirect } from "next/navigation"
import { isAdminAuthenticated, isAdminProtectionEnabled } from "@/lib/auth/admin"
import { AdminLoginForm } from "@/components/dashboard/admin-login-form"

// ADMIN_PASSWORD is read at request time — never prerender the redirect
export const dynamic = "force-dynamic"

export default async function AdminLoginPage() {
    // No ADMIN_PASSWORD (demo mode, or unprotected live) — no login required
    if (!isAdminProtectionEnabled()) redirect("/admin/jh")
    if (await isAdminAuthenticated()) redirect("/admin/jh")

    return (
        <div className="h-full flex items-center justify-center p-8">
            <AdminLoginForm />
        </div>
    )
}
