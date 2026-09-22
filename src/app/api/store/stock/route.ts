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
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get('variant_ids')?.split(',').filter(Boolean) ?? []
  if (!ids.length) return NextResponse.json({ stock: {} })

  const { data } = await getClient()
    .from('stock_disponible')
    .select('variant_id, quantity_disponible')
    .in('variant_id', ids)

  const stock: Record<string, number> = {}
  for (const id of ids) stock[id] = 0
  for (const row of data ?? []) stock[row.variant_id] = row.quantity_disponible

  return NextResponse.json({ stock }, {
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': process.env.STORE_ORIGIN ?? '*',
    },
  })
}

export const dynamic = 'force-dynamic'
