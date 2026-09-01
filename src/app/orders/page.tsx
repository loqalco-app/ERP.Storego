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

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, folio, status, subtotal, discount_amount, total, created_at,
      customers(id, full_name, email, phone),
      order_items(id, product_name, variant_name, sku, quantity, unit_price, discount_amount, subtotal),
      order_payments(id, method, amount),
      order_shipping(id, type, address_line1, address_line2, city, state, zip)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  return <OrdersClient orders={(orders ?? []) as any[]} />
}
