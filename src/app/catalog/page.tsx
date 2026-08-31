import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CatalogClient from './CatalogClient'

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
      id, name, status, condition, created_at, category_id, brand_id,
      categories(id, name),
      brands(id, name),
      product_variants(id, sku, sale_price, stock_levels(quantity_available))
    `).eq('organization_id', orgId).order('created_at', { ascending: false }),

    supabase.from('categories').select('id, name, slug, description, parent_id').eq('organization_id', orgId).order('name'),

    supabase.from('brands').select('id, name, description').eq('organization_id', orgId).order('name'),
  ])

  const userName = profile?.full_name && !profile.full_name.includes('@')
    ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')
  const orgName = (profile?.organizations as unknown as { name: string } | null)?.name ?? 'Store ERP'

  return (
    <CatalogClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products={(products ?? []) as any[]}
      categories={categories ?? []}
      brands={brands ?? []}
      orgId={orgId}
      userName={userName}
      orgName={orgName}
    />
  )
}
