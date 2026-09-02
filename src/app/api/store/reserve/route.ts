import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// POST /api/store/reserve
// Body: { org_id?, session_id, variant_id, quantity }
export async function POST(req: NextRequest) {
  let body: { org_id?: string; session_id?: string; variant_id?: string; quantity?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const orgId     = body.org_id ?? process.env.STORE_ORG_ID
  const sessionId = body.session_id
  const variantId = body.variant_id
  const quantity  = body.quantity

  if (!orgId || !sessionId || !variantId || !quantity || quantity < 1) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const client = getClient()

  const { data: stock } = await client
    .from('stock_disponible')
    .select('quantity_disponible')
    .eq('variant_id', variantId)
    .single()

  const available = stock?.quantity_disponible ?? 0
  if (available < quantity) {
    return NextResponse.json({ error: 'insufficient_stock', available }, { status: 409 })
  }

  // Release any existing pending reservation for this session + variant
  await client
    .from('inventory_reservations')
    .update({ status: 'released', updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('variant_id', variantId)
    .eq('status', 'pending')

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const { data: reservation, error } = await client
    .from('inventory_reservations')
    .insert({ organization_id: orgId, variant_id: variantId, quantity, session_id: sessionId, status: 'pending', expires_at: expiresAt })
    .select('id, expires_at')
    .single()

  if (error || !reservation) {
    return NextResponse.json({ error: 'reserve_failed' }, { status: 500 })
  }

  return NextResponse.json({ reservation_id: reservation.id, expires_at: reservation.expires_at, quantity })
}

export const dynamic = 'force-dynamic'
