import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Bulk, always-fresh stock lookup — used by the storefront to show "Agotado"
// without waiting on the 60s product-catalog cache.
//
// Reads real committed stock (stock_levels), NOT stock_disponible — that
// view also subtracts other shoppers' pending cart reservations, so an
// item someone merely added to their cart (never paid for) would flash
// "Agotado" for everyone else too. The "Agotado" badge should only ever
// reflect confirmed backend state (a completed sale), not a 15-minute
// hold. Anti-oversell itself still lives where it belongs — the reserve
// and checkout endpoints still check stock_disponible before committing.
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get('variant_ids')?.split(',').filter(Boolean) ?? []
  if (!ids.length) return NextResponse.json({ stock: {} })

  const { data } = await getClient()
    .from('stock_levels')
    .select('variant_id, quantity_available')
    .in('variant_id', ids)

  const stock: Record<string, number> = {}
  for (const id of ids) stock[id] = 0
  for (const row of data ?? []) stock[row.variant_id] = (stock[row.variant_id] ?? 0) + Number(row.quantity_available)

  return NextResponse.json({ stock }, {
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': process.env.STORE_ORIGIN ?? '*',
    },
  })
}

export const dynamic = 'force-dynamic'
