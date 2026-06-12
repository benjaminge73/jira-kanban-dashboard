import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Demo mode — no authentication required. All routes are public.
export async function proxy(_request: NextRequest) {
    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
