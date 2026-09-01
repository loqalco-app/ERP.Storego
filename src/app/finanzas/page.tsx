import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FinanzasClient from './FinanzasClient'

export default async function FinanzasPage({ searchParams }: { searchParams: Promise<{ periodo?: string; desde?: string; hasta?: string }> }) {
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

  const params = await searchParams
  const periodo = params.periodo ?? 'mes'

  // Calcular rango de fechas según periodo
  const now = new Date()
  let desde: string
  let hasta: string

  if (params.desde && params.hasta) {
    desde = params.desde
    hasta = params.hasta
  } else if (periodo === 'hoy') {
    desde = now.toISOString().slice(0, 10)
    hasta = desde
  } else if (periodo === 'semana') {
    const d = new Date(now); d.setDate(d.getDate() - d.getDay())
    desde = d.toISOString().slice(0, 10)
    hasta = now.toISOString().slice(0, 10)
  } else if (periodo === 'año') {
    desde = `${now.getFullYear()}-01-01`
    hasta = now.toISOString().slice(0, 10)
  } else {
    // mes (default)
    desde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    hasta = now.toISOString().slice(0, 10)
  }

  const desdeTs = `${desde}T00:00:00`
  const hastaTs = `${hasta}T23:59:59`

  const [
    { data: orders },
    { data: expenses },
    { data: apartados },
  ] = await Promise.all([
    // Órdenes del periodo con sus items (para CMV)
    supabase
      .from('orders')
      .select(`
        id, folio, status, total, created_at,
        customers(full_name),
        order_items(product_name, variant_name, quantity, unit_price, cost_price),
        order_payments(method, amount)
      `)
      .eq('organization_id', orgId)
      .neq('status', 'cancelado')
      .gte('created_at', desdeTs)
      .lte('created_at', hastaTs)
      .order('created_at', { ascending: false }),

    // Gastos del periodo (tabla puede no existir aún)
    supabase
      .from('finance_expenses')
      .select('id, date, category, description, amount, created_at')
      .eq('organization_id', orgId)
      .gte('date', desde)
      .lte('date', hasta)
      .order('date', { ascending: false }),

    // Apartados pendientes (cuentas por cobrar) — todos, no solo del periodo
    supabase
      .from('orders')
      .select('id, folio, total, customers(full_name), order_payments(amount)')
      .eq('organization_id', orgId)
      .eq('status', 'apartado'),
  ])

  return (
    <FinanzasClient
      orgId={orgId}
      userId={user.id}
      orders={(orders ?? []) as any[]}
      expenses={(expenses ?? []) as any[]}
      apartados={(apartados ?? []) as any[]}
      periodo={periodo}
      desde={desde}
      hasta={hasta}
    />
  )
}
