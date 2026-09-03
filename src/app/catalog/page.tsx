import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CatalogClient from './CatalogClient'

export const dynamic = 'force-dynamic'

export default async function CatalogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('full_name, organization_id, organizations(name)').eq('id', user.id).single()

  const orgId = profile?.organization_id

  console.log('[catalog/page] user.id =', user.id, 'orgId =', orgId)

  const [
    { data: products, error: productsErr },
    { data: categories, error: categoriesErr },
    { data: brands, error: brandsErr },
    { data: stockLevels, error: stockErr },
  ] = await Promise.all([
    supabase.from('products').select(`
      id, name, status, condition, created_at, category_id, brand_id,
      categories(id, name),
      brands(id, name),
      product_variants(id, sku, sale_price, cost_price)
    `).eq('organization_id', orgId).order('created_at', { ascending: false }),

    supabase.from('categories').select('id, name, slug, description, parent_id').eq('organization_id', orgId).order('name'),

    supabase.from('brands').select('id, name, description').eq('organization_id', orgId).order('name'),

    supabase.from('stock_levels').select('variant_id, quantity_available'),
  ])

  console.log('[catalog/page] productsErr =', JSON.stringify(productsErr))
  console.log('[catalog/page] products.length =', products?.length, 'raw:', JSON.stringify(products)?.slice(0, 2000))
  console.log('[catalog/page] categoriesErr =', JSON.stringify(categoriesErr), 'count =', categories?.length)
  console.log('[catalog/page] brandsErr =', JSON.stringify(brandsErr), 'count =', brands?.length)
  console.log('[catalog/page] stockErr =', JSON.stringify(stockErr), 'count =', stockLevels?.length)

  // Merge stock into variants
  const stockMap: Record<string, number> = {}
  for (const sl of stockLevels ?? []) {
    stockMap[sl.variant_id] = (stockMap[sl.variant_id] ?? 0) + sl.quantity_available
  }

  const productsWithStock = (products ?? []).map(p => ({
    ...p,
    product_variants: (p.product_variants ?? []).map((v: { id: string; sku: string; sale_price: number; cost_price: number }) => ({
      ...v,
      stock_levels: [{ quantity_available: stockMap[v.id] ?? 0 }],
    })),
  }))

  const userName = profile?.full_name && !profile.full_name.includes('@')
    ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')
  const orgName = (profile?.organizations as unknown as { name: string } | null)?.name ?? 'NORTHÉA'

  return (
    <CatalogClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products={productsWithStock as any[]}
      categories={categories ?? []}
      brands={brands ?? []}
      orgId={orgId}
      userName={userName}
      orgName={orgName}
    />
  )
}
