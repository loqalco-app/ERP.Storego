import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import POSClient from './POSClient'

export default async function POSPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/login')
  const orgId = profile.organization_id

  const [{ data: rawProducts }, { data: customers }] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id, name,
        product_variants(
          id, name, sku, sale_price, status,
          stock_levels(quantity_available)
        )
      `)
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('customers')
      .select('id, full_name, email, phone')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .order('full_name'),
  ])

  // Flatten stock per variant
  const products = (rawProducts ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    variants: (p.product_variants ?? [])
      .filter((v: any) => v.status === 'active')
      .map((v: any) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        sale_price: Number(v.sale_price),
        stock: (v.stock_levels ?? []).reduce(
          (sum: number, sl: any) => sum + Number(sl.quantity_available ?? 0), 0
        ),
      })),
  })).filter((p: any) => p.variants.length > 0)

  return (
    <POSClient
      orgId={orgId}
      userId={user.id}
      initialProducts={products}
      initialCustomers={customers ?? []}
    />
  )
}
