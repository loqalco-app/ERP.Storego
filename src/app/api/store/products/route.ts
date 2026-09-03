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
      const client = getClient()

      const [{ data: products, error }, { data: categories, error: catErr }] = await Promise.all([
        client
          .from('products')
          .select(`
            id, name, slug, description, created_at, category_id,
            product_variants(id, name, sku, sale_price, status),
            product_images(url, is_primary, sort_order, alt_text),
            store_product_categories(category_id)
          `)
          .eq('organization_id', orgId)
          .eq('is_published', true)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),

        client
          .from('categories')
          .select('id, parent_id, name, slug, web_sort_order')
          .eq('organization_id', orgId)
          .eq('is_web_visible', true)
          .order('web_sort_order'),
      ])

      if (error) throw error
      if (catErr) throw catErr

      // Attach a flat list of category ids each product belongs to (primary + extra assignments)
      const productsWithCats = (products ?? []).map(p => {
        const extra = (p.store_product_categories ?? []).map((a: { category_id: string }) => a.category_id)
        const categoryIds = Array.from(new Set([p.category_id, ...extra].filter(Boolean))) as string[]
        const { store_product_categories: _omit, ...rest } = p
        return { ...rest, category_ids: categoryIds }
      })

      return { products: productsWithCats, categories: categories ?? [] }
    },
    [`store-catalog-${orgId}`],
    { revalidate: 60, tags: [`catalog-${orgId}`] },
  )

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('org') ?? process.env.STORE_ORG_ID
  const categorySlug = req.nextUrl.searchParams.get('category')
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 })

  try {
    const { products, categories } = await getCatalog(orgId)()

    let filtered = products
    if (categorySlug) {
      const cat = categories.find(c => c.slug === categorySlug)
      filtered = cat ? products.filter(p => p.category_ids.includes(cat.id)) : []
    }

    return NextResponse.json({ products: filtered, categories }, {
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
