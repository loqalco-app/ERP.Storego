import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

// POST /api/pos/check-stock
// Authoritative, real-time stock check for the POS — reads the same
// stock_disponible view the storefront uses (on-hand minus active web-cart
// reservations), so a POS sale can never oversell something a web shopper
// currently has reserved, or that's simply run out. This is the actual
// safety net; any client-side quantity cap is just early UX feedback.
export async function POST(req: NextRequest) {
  const { variant_ids } = await req.json().catch(() => ({ variant_ids: null }))
  if (!Array.isArray(variant_ids) || variant_ids.length === 0) {
    return NextResponse.json({ error: 'variant_ids required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: rows } = await admin
    .from('stock_disponible')
    .select('variant_id, quantity_disponible')
    .in('variant_id', variant_ids)

  const stock: Record<string, number> = {}
  for (const id of variant_ids) stock[id] = 0
  for (const row of rows ?? []) {
    stock[row.variant_id] = (stock[row.variant_id] ?? 0) + Number(row.quantity_disponible)
  }

  return NextResponse.json({ stock })
}

export const dynamic = 'force-dynamic'
