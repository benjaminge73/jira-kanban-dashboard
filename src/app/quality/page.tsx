import { fetchAllTickets, fetchAllTransitions, calculateBackflow, calculatePeriodRejections } from "@/lib/actions/kpis"
import { getUiMeta } from "@/lib/actions/meta"
import { QualityKpiCards } from "@/components/dashboard/quality-kpi-cards"
import { QualityReasonsChart } from "@/components/dashboard/quality-reasons-chart"
import { QualityBrandBreakdown } from "@/components/dashboard/quality-brand-breakdown"
import { QualityRejectionsDetail } from "@/components/dashboard/quality-rejections-detail"
import { PageHeader, SectionHeader, TranslatedText } from "@/components/layout/page-header"

export const revalidate = 0 // Disable cache

export default async function QualityPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams;
    const fromStr = typeof params.from === 'string' ? params.from : undefined;
    const toStr = typeof params.to === 'string' ? params.to : undefined;

    const meta = await getUiMeta();
    const allTickets = await fetchAllTickets();
    const allTransitions = await fetchAllTransitions();

    // Determine "completion date" for each ticket based on when it last entered a target status
    const targetStatuses = ["done", "ready for release"];
    const ticketCompletionDates = new Map<string, number>();

    for (const t of allTransitions) {
        // Ignore self-transitions (e.g. Jira automation "Done → Done" daily noise)
        if (t.from_status === t.to_status) continue;
        if (t.to_status && targetStatuses.includes(t.to_status.toLowerCase())) {
            const tTime = new Date(t.transition_date).getTime();
            const current = ticketCompletionDates.get(t.issue_key) || 0;
            if (tTime > current) {
                ticketCompletionDates.set(t.issue_key, tTime);
            }
        }
    }

    // Filter tickets to only those that "completed" in the period
    let fromDate = fromStr ? new Date(fromStr).getTime() : 0;
    let toDate = toStr ? new Date(toStr).getTime() + 86400000 : Infinity;

    const periodTickets = allTickets.filter(ticket => {
        if (!ticket.status || !targetStatuses.includes(ticket.status.toLowerCase())) return false;

        const compTime = ticketCompletionDates.get(ticket.issue_key);
        if (!compTime) {
            if (!ticket.resolution_date) return false;
            const resTime = new Date(ticket.resolution_date).getTime();
            return resTime >= fromDate && resTime <= toDate;
        }

        return compTime >= fromDate && compTime <= toDate;
    });

    // Pass ALL transitions to calculateBackflow so it can find rejections from BEFORE the period
    const kpis = await calculateBackflow(periodTickets, allTransitions);

    // Filter transitions strictly within the selected period to supply the isolated Rejections component data
    const periodTransitions = allTransitions.filter(t => {
        const tTime = new Date(t.transition_date).getTime();
        return tTime >= fromDate && tTime <= toDate;
    });

    const periodRejections = await calculatePeriodRejections(allTickets, periodTransitions);

    // Calculate aggregated points and mandays for CURRENT period
    let totalPoints = 0;
    let rejectedPoints = 0;
    let totalMandays = 0;
    let rejectedMandays = 0;

    const brandBreakdownData: { brand: string, ftr: number }[] = [];

    for (const [brand, stats] of Object.entries(kpis.brands)) {
        totalPoints += stats.total_points;
        rejectedPoints += stats.rejected_points;
        totalMandays += stats.total_mandays;
        rejectedMandays += stats.rejected_mandays;

        let brandFtr = stats.total_tickets > 0
            ? ((stats.total_tickets - stats.rejected_tickets) / stats.total_tickets) * 100
            : 100;
        if (brandFtr < 0) brandFtr = 0;

        brandBreakdownData.push({ brand, ftr: Number(brandFtr.toFixed(1)) });
    }

    let ftrPointsPct = totalPoints > 0 ? ((totalPoints - rejectedPoints) / totalPoints) * 100 : 100;
    if (ftrPointsPct < 0) ftrPointsPct = 0;

    let ftrMandaysPct = totalMandays > 0 ? ((totalMandays - rejectedMandays) / totalMandays) * 100 : 100;
    if (ftrMandaysPct < 0) ftrMandaysPct = 0;

    // Calcul pour la période précédente
    let pastFtrPct: number | null = null;
    let pastFtrPointsPct: number | null = null;
    let pastFtrMandaysPct: number | null = null;

    if (fromStr && toStr) {
        const duration = toDate - fromDate;
        const pastFromDate = fromDate - duration;
        const pastToDate = fromDate;

        const pastPeriodTickets = allTickets.filter(ticket => {
            if (!ticket.status || !targetStatuses.includes(ticket.status.toLowerCase())) return false;

            const compTime = ticketCompletionDates.get(ticket.issue_key);
            if (!compTime) {
                if (!ticket.resolution_date) return false;
                const resTime = new Date(ticket.resolution_date).getTime();
                return resTime >= pastFromDate && resTime < pastToDate; // Use < to not overlap
            }

            return compTime >= pastFromDate && compTime < pastToDate;
        });

        const pastKpis = await calculateBackflow(pastPeriodTickets, allTransitions);

        pastFtrPct = pastKpis.first_time_right_pct;

        let pastTotalPoints = 0;
        let pastRejectedPoints = 0;
        let pastTotalMandays = 0;
        let pastRejectedMandays = 0;

        for (const stats of Object.values(pastKpis.brands)) {
            pastTotalPoints += stats.total_points;
            pastRejectedPoints += stats.rejected_points;
            pastTotalMandays += stats.total_mandays;
            pastRejectedMandays += stats.rejected_mandays;
        }

        pastFtrPointsPct = pastTotalPoints > 0 ? ((pastTotalPoints - pastRejectedPoints) / pastTotalPoints) * 100 : 100;
        if (pastFtrPointsPct < 0) pastFtrPointsPct = 0;

        pastFtrMandaysPct = pastTotalMandays > 0 ? ((pastTotalMandays - pastRejectedMandays) / pastTotalMandays) * 100 : 100;
        if (pastFtrMandaysPct < 0) pastFtrMandaysPct = 0;
    }

    const reasonsData = [
        { name: "Dev", value: periodRejections.rejections_by_category.Dev },
        { name: "QA", value: periodRejections.rejections_by_category.QA },
        { name: "Business", value: periodRejections.rejections_by_category.Business },
    ].filter(d => d.value > 0);

    const liveDataBadge = (
        <span className="text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <TranslatedText k={meta.mode === "live" ? "dashboard.liveData" : "dashboard.demoData"} />
        </span>
    )

    return (
        <div className="p-8 space-y-8">
            <PageHeader titleKey="quality.title" />

            <div className="pt-4 border-t border-border/50">
                <h2 className="text-2xl font-semibold tracking-tight mb-2 text-foreground/90">
                    <TranslatedText k="quality.ftrTitle" />
                </h2>
                <p className="text-muted-foreground mb-6">
                    <TranslatedText k="quality.ftrDesc" />
                </p>
                <QualityKpiCards
                    kpis={kpis}
                    ftrPoints={ftrPointsPct}
                    ftrMandays={ftrMandaysPct}
                    pastFtrPct={pastFtrPct}
                    pastFtrPoints={pastFtrPointsPct}
                    pastFtrMandays={pastFtrMandaysPct}
                    totalPoints={totalPoints}
                    totalMandays={totalMandays}
                />

                <div className="mt-8 grid gap-8 md:grid-cols-2">
                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-border/50 bg-muted/20">
                            <SectionHeader
                                titleKey="quality.byBrand"
                                subtitleKey="quality.byBrandDesc"
                                badge={liveDataBadge}
                            />
                        </div>
                        <div className="p-6">
                            <QualityBrandBreakdown data={brandBreakdownData} brandColors={meta.brandColors} />
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-border/50 bg-muted/20">
                            <SectionHeader
                                titleKey="quality.rejectionOrigins"
                                subtitleKey="quality.rejectionOriginsDesc"
                                badge={liveDataBadge}
                            />
                        </div>
                        <div className="p-6">
                            <QualityReasonsChart data={reasonsData} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-8 border-t border-border/50">
                <h2 className="text-2xl font-semibold tracking-tight mb-2 text-foreground/90">
                    <TranslatedText k="quality.overviewTitle" />
                </h2>
                <p className="text-muted-foreground mb-6">
                    <TranslatedText k="quality.overviewDesc" />
                </p>

                <QualityRejectionsDetail
                    data={periodRejections.rejections_detail_by_brand}
                />
            </div>
        </div>
    )
}
