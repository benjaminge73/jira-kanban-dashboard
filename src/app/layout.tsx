import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { LanguageProvider } from "@/lib/i18n/context";
import { getDataSource, getMode } from "@/lib/data-source";
import { getAppSettings } from "@/lib/actions/settings";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata = {
    title: "Kanban mAIster",
    description: "Kanban Analytics Dashboard — flow, quality and budget KPIs",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const mode = getMode();
    const { showBudgetTab } = await getAppSettings();
    const calendarBounds = getDataSource().getCalendarBounds();

    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem={false}
                    disableTransitionOnChange
                >
                    <LanguageProvider>
                        <div className="flex h-screen overflow-hidden">
                            {/* Sidebar fixed on the left */}
                            <Sidebar mode={mode} showBudgetTab={showBudgetTab} calendarBounds={calendarBounds} />

                            {/* Main Content Area */}
                            <main className="flex-1 overflow-y-auto">
                                {children}
                            </main>
                        </div>
                    </LanguageProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
