import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrdersClient from './OrdersClient'

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

  // Slim query — items/shipping loaded on-demand when order is tapped
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, folio, status, total, created_at,
      customers(id, full_name, phone, email),
      order_payments(id, method, amount, created_at)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  return <OrdersClient orders={(orders ?? []) as any[]} orgId={orgId} />
}
