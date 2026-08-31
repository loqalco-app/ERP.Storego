import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Datos del perfil y organización
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, organization_id, organizations(name)')
    .eq('id', user.id)
    .single()

  // Stats básicas
  const orgId = profile?.organization_id

  const [
    { count: totalProducts },
    { count: totalCustomers },
    { count: totalVariants },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
    supabase.from('product_variants').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
  ])

  // Clientes recientes
  const { data: recentCustomers } = await supabase
    .from('customers')
    .select('id, full_name, email, phone, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <DashboardClient
      userName={profile?.full_name ?? user.email ?? 'Usuario'}
      orgName={(profile?.organizations as { name: string } | null)?.name ?? 'Store ERP'}
      stats={{
        products: totalProducts ?? 0,
        customers: totalCustomers ?? 0,
        variants: totalVariants ?? 0,
      }}
      recentCustomers={recentCustomers ?? []}
    />
  )
}
