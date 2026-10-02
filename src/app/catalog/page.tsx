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

  const [
    { data: products },
    { data: categories },
    { data: brands },
  ] = await Promise.all([
    supabase.from('products').select(`
      id, name, status, condition, created_at, category_id, brand_id, is_published, is_featured,
      categories!products_category_id_fkey(id, name),
      brands(id, name),
      product_variants(id, sku, sale_price, cost_price, regular_price),
      product_images(url, is_primary, sort_order)
    `).eq('organization_id', orgId).order('created_at', { ascending: false }),

    supabase.from('categories').select('id, name, slug, description, parent_id').eq('organization_id', orgId).order('name'),

    supabase.from('brands').select('id, name').eq('organization_id', orgId).order('name'),
  ])

  // stock_levels no tiene organization_id propio — se acota por los variant_id
  // de esta organización (antes jalaba el stock de TODAS las organizaciones
  // del sistema en cada carga de Catálogo).
  const variantIds = (products ?? []).flatMap(p => (p.product_variants ?? []).map((v: { id: string }) => v.id))
  const { data: stockLevels } = variantIds.length
    ? await supabase.from('stock_levels').select('variant_id, quantity_available').in('variant_id', variantIds)
    : { data: [] as { variant_id: string; quantity_available: number }[] }

  // Merge stock into variants
  const stockMap: Record<string, number> = {}
  for (const sl of stockLevels ?? []) {
    stockMap[sl.variant_id] = (stockMap[sl.variant_id] ?? 0) + sl.quantity_available
  }

  const productsWithStock = (products ?? []).map(p => ({
    ...p,
    product_variants: (p.product_variants ?? []).map((v: { id: string; sku: string; sale_price: number; cost_price: number; regular_price: number | null }) => ({
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
      brands={(brands ?? []).map(b => ({ ...b, description: null }))}
      orgId={orgId}
      userName={userName}
      orgName={orgName}
    />
  )
}
