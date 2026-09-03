import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const orgId = req.nextUrl.searchParams.get('org') ?? process.env.STORE_ORG_ID
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  const client = getClient()

  const { data: product, error } = await client
    .from('products')
    .select(`
      id, name, slug, description, created_at, category_id,
      product_variants(id, name, sku, sale_price, status),
      product_images(url, is_primary, sort_order, alt_text),
      store_product_categories(category_id)
    `)
    .eq('organization_id', orgId)
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error || !product) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const variantIds = (product.product_variants as { id: string }[]).map(v => v.id)
  const { data: stock } = await client
    .from('stock_disponible')
    .select('variant_id, quantity_disponible')
    .in('variant_id', variantIds)

  const stockMap: Record<string, number> = {}
  for (const s of stock ?? []) stockMap[s.variant_id] = s.quantity_disponible

  const variants = (product.product_variants as { id: string; name: string; sku: string; sale_price: number; status: string }[]).map(v => ({
    ...v,
    quantity_disponible: stockMap[v.id] ?? 0,
    in_stock: (stockMap[v.id] ?? 0) > 0,
  }))

  const extraCatIds = (product.store_product_categories as { category_id: string }[] ?? []).map(a => a.category_id)
  const categoryIds = Array.from(new Set([product.category_id, ...extraCatIds].filter(Boolean))) as string[]

  const { data: categories } = categoryIds.length
    ? await client.from('categories').select('id, parent_id, name, slug').in('id', categoryIds)
    : { data: [] as { id: string; parent_id: string | null; name: string; slug: string }[] }

  const { store_product_categories: _omit, ...productRest } = product

  return NextResponse.json(
    { product: { ...productRest, product_variants: variants, categories: categories ?? [] } },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        'Access-Control-Allow-Origin': process.env.STORE_ORIGIN ?? '*',
      },
    },
  )
}

export const dynamic = 'force-dynamic'
