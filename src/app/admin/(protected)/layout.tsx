import { getMode } from "@/lib/data-source"
import { AdminHeader } from "@/components/layout/admin-header"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const mode = getMode()

    return (
        <div className="flex flex-col h-full">
            <AdminHeader mode={mode} />
            <div className="flex-1 overflow-auto">
                {children}
            </div>
        </div>
    )
}
