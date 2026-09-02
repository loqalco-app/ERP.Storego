import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import CustomerDetailClient from './CustomerDetailClient'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('organization_id').eq('id', user.id).single()

  const orgId = profile?.organization_id
  if (!orgId) redirect('/dashboard')

  const [{ data: customer }, { data: orders }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, full_name, email, phone, tax_id, notes, status, credit_limit, balance_owing, tags, created_at')
      .eq('id', id).eq('organization_id', orgId).single(),
    supabase
      .from('orders')
      .select('id, folio, status, subtotal, discount_amount, total, created_at, order_items(id, product_name, variant_name, quantity, unit_price, discount_amount, subtotal), order_payments(id, method, amount)')
      .eq('customer_id', id).eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
  ])

  if (!customer) notFound()

  return (
    <CustomerDetailClient
      customer={customer as any}
      orders={(orders ?? []) as any}
      orgId={orgId}
    />
  )
}
