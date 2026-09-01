import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, organization_id, organizations(name)')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/login')
  const orgId = profile.organization_id

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [
    { count: totalProducts },
    { count: totalCustomers },
    { count: totalVariants },
    { count: totalOrders },
    { data: monthOrders },
    { data: recentOrders },
    { data: recentCustomers },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'active'),
    supabase.from('product_variants').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
    supabase.from('orders').select('total').eq('organization_id', orgId).gte('created_at', startOfMonth.toISOString()).neq('status', 'cancelado'),
    supabase.from('orders').select('id, folio, total, status, created_at, customers(full_name)').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(5),
    supabase.from('customers').select('id, full_name, email, phone, created_at').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(5),
  ])

  return (
    <DashboardClient
      userName={profile?.full_name && !profile.full_name.includes('@') ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')}
      orgName={(profile?.organizations as unknown as { name: string } | null)?.name ?? 'Store ERP'}
      stats={{
        products: totalProducts ?? 0,
        customers: totalCustomers ?? 0,
        variants: totalVariants ?? 0,
        orders: totalOrders ?? 0,
        monthRevenue: (monthOrders ?? []).reduce((s, o) => s + Number(o.total), 0),
      }}
      recentOrders={(recentOrders ?? []) as any[]}
      recentCustomers={recentCustomers ?? []}
    />
  )
}
