import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const getCatalog = (orgId: string) =>
  unstable_cache(
    async () => {
      const { data, error } = await getClient()
        .from('products')
        .select(`
          id, name, slug, description, created_at,
          product_variants(id, name, sku, sale_price, status),
          product_images(url, is_primary, sort_order, alt_text)
        `)
        .eq('organization_id', orgId)
        .eq('is_published', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
    [`store-catalog-${orgId}`],
    { revalidate: 60, tags: [`catalog-${orgId}`] },
  )

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org') ?? process.env.STORE_ORG_ID
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  try {
    const products = await getCatalog(orgId)()
    return NextResponse.json({ products }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': process.env.STORE_ORIGIN ?? '*',
      },
    })
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
