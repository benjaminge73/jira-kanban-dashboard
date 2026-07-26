import { redirect } from "next/navigation"
import { getMode } from "@/lib/data-source"
import { isAdminAuthenticated, isAdminProtectionEnabled } from "@/lib/auth/admin"
import { AdminHeader } from "@/components/layout/admin-header"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const mode = getMode()
    const authEnabled = isAdminProtectionEnabled()

    if (authEnabled && !(await isAdminAuthenticated())) {
        redirect("/admin/login")
    }

    return (
        <div className="flex flex-col h-full">
            <AdminHeader
                mode={mode}
                authEnabled={authEnabled}
                warnNoPassword={mode === "live" && !authEnabled}
            />
            <div className="flex-1 overflow-auto">
                {children}
            </div>
        </div>
    )
}
