import type { NextConfig } from "next";

const securityHeaders = [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
    },
    {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
    },
    {
        key: "Content-Security-Policy",
        value: [
            "default-src 'self'",
            // Next.js hydration + inline styles (Tailwind) require unsafe-inline
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self'",
            // All external API calls (Jira) happen server-side; the browser only talks to the app
            "connect-src 'self'",
            // Redundant with X-Frame-Options but explicit for modern browsers
            "frame-ancestors 'none'",
        ].join("; "),
    },
];

const nextConfig: NextConfig = {
    headers: async () => [
        {
            source: "/(.*)",
            headers: securityHeaders,
        },
    ],
};

export default nextConfig;
