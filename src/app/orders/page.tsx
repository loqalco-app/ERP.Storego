import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrdersClient from './OrdersClient'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/login')
  const orgId = profile.organization_id

  // Fetch orders + team profiles in parallel
  const [{ data: orders }, { data: sellers }] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        id, folio, status, total, created_at, source, created_by,
        customers(id, full_name, phone, email),
        order_payments(id, method, amount, created_at)
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('user_profiles')
      .select('id, full_name')
      .eq('organization_id', orgId),
  ])

  // Build id → name map for fast lookup in client
  const sellersMap: Record<string, string> = {}
  for (const s of sellers ?? []) sellersMap[s.id] = s.full_name ?? ''

  return <OrdersClient orders={(orders ?? []) as any[]} orgId={orgId} sellersMap={sellersMap} />
}
