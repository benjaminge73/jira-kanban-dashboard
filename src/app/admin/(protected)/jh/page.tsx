import { fetchBilledDays, fetchPlannedRates } from "@/lib/actions/budget"
import { getUiMeta } from "@/lib/actions/meta"
import { getAppSettings } from "@/lib/actions/settings"
import { JHManagementClient } from "@/components/dashboard/jh-management-client"
import { AdminSettingsClient } from "@/components/dashboard/admin-settings-client"
import { PageHeader } from "@/components/layout/page-header"

export const revalidate = 0

export default async function JHPage() {
    const [billedWeeks, billedMonths, plannedRates, meta, settings] = await Promise.all([
        fetchBilledDays("week"),
        fetchBilledDays("month"),
        fetchPlannedRates(),
        getUiMeta(),
        getAppSettings(),
    ])
    const isLive = meta.mode === "live"

    return (
        <div className="p-8 space-y-8">
            <PageHeader titleKey="admin.title" subtitleKey={isLive ? "admin.subtitleLive" : "admin.subtitle"} />

            <AdminSettingsClient showBudgetTab={settings.showBudgetTab} readOnly={!isLive} />

            <JHManagementClient
                billedWeeks={billedWeeks}
                billedMonths={billedMonths}
                plannedRates={plannedRates}
                brands={meta.brands}
                readOnly={!isLive}
                liveMode={isLive}
            />
        </div>
    )
}
