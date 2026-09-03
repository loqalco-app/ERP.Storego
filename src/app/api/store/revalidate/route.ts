import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

export async function POST(req: NextRequest) {
  const { orgId } = await req.json().catch(() => ({ orgId: null }))
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })
  revalidateTag(`catalog-${orgId}`, { expire: 0 })
  return NextResponse.json({ ok: true })
}
