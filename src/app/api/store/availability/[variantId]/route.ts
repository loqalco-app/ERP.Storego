import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ variantId: string }> },
) {
  const { variantId } = await params

  const { data } = await getClient()
    .from('stock_disponible')
    .select('variant_id, quantity_disponible')
    .eq('variant_id', variantId)
    .single()

  return NextResponse.json(
    {
      variant_id: variantId,
      quantity_disponible: data?.quantity_disponible ?? 0,
      in_stock: (data?.quantity_disponible ?? 0) > 0,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': process.env.STORE_ORIGIN ?? '*',
      },
    },
  )
}

export const dynamic = 'force-dynamic'
