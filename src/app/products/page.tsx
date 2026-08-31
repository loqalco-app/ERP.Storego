import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProductsClient from './ProductsClient'

export default async function ProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, organization_id, organizations(name)')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organization_id

  const { data: products } = await supabase
    .from('products')
    .select(`
      id, name, slug, status, condition, is_published, created_at,
      categories(name),
      brands(name),
      product_variants(id, sku, sale_price, cost_price, status)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  return (
    <ProductsClient
      products={products ?? []}
      userName={profile?.full_name && !profile.full_name.includes('@') ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')}
      orgName={(profile?.organizations as unknown as { name: string } | null)?.name ?? 'Store ERP'}
    />
  )
}
