import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyNewOrder } from '@/lib/push'

// POST /api/orders/notify-sale
// Called by the ERP's own POS after closing a sale, so the "new sale" push
// fires for in-person sales too (not just the public storefront checkout).
export async function POST(req: NextRequest) {
  const { order_id } = await req.json().catch(() => ({ order_id: null }))
  if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('organization_id').eq('id', user.id).single()
  const orgId = profile?.organization_id
  if (!orgId) return NextResponse.json({ error: 'no_org' }, { status: 403 })

  const { data: order } = await supabase
    .from('orders')
    .select('folio, total, source, organization_id, customers(full_name), order_items(id)')
    .eq('id', order_id)
    .eq('organization_id', orgId)
    .single()

  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const customerRel = Array.isArray(order.customers) ? order.customers[0] : order.customers
  await notifyNewOrder(orgId, {
    folio: order.folio,
    total: Number(order.total),
    customerName: customerRel?.full_name ?? 'Cliente',
    source: order.source ?? 'pos',
    itemCount: (order.order_items ?? []).length,
  })

  return NextResponse.json({ ok: true })
}
