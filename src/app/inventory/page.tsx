import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InventoryClient from './InventoryClient'

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('full_name, organization_id, organizations(name)').eq('id', user.id).single()

  const orgId = profile?.organization_id

  const { data: variants } = await supabase
    .from('product_variants')
    .select(`
      id, name, sku, sale_price, cost_price, status,
      products!inner(id, name, status, organization_id),
      stock_levels(quantity_available, quantity_reserved, quantity_damaged, location_id, inventory_locations(name))
    `)
    .eq('organization_id', orgId)
    .eq('products.organization_id', orgId)
    .order('sku')

  return (
    <InventoryClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      variants={(variants ?? []) as any[]}
      orgId={orgId}
      userName={profile?.full_name && !profile.full_name.includes('@') ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')}
      orgName={(profile?.organizations as unknown as { name: string } | null)?.name ?? 'Store ERP'}
    />
  )
}
