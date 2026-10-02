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

  const [{ data: rawProducts }, { data: customers }, { data: org }] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id, name,
        product_images(url, is_primary, sort_order, variant_id),
        product_variants(
          id, name, sku, sale_price, cost_price, status,
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
    supabase
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .single(),
  ])

  const bankDetails = (org?.settings as { bank_transfer?: { bank?: string; holder?: string; clabe?: string; account?: string } } | null)?.bank_transfer ?? null

  // Flatten stock per variant — y cada variante lleva su propia foto (si no
  // tiene una propia, cae a otra foto de su mismo color, y si no a la del
  // producto) para que en POS cambie la imagen al cambiar de color/talla.
  const products = (rawProducts ?? []).map((p: any) => {
    const imgs = [...(p.product_images ?? [])].sort((a: any, b: any) => (b.is_primary ? 1 : -1) - (a.is_primary ? 1 : -1) || a.sort_order - b.sort_order)
    const productImage = imgs.length ? imgs[0].url : null
    const activeVariants = (p.product_variants ?? []).filter((v: any) => v.status === 'active')
    const colorOf = (name: string) => (name.includes(' / ') ? name.split(' / ')[0] : name)
    const variantIdToColor = new Map(activeVariants.map((v: any) => [v.id, colorOf(v.name)]))
    return {
      id: p.id,
      name: p.name,
      image: productImage,
      variants: activeVariants.map((v: any) => {
        const ownImg = imgs.find((im: any) => im.variant_id === v.id)
        const colorImg = !ownImg ? imgs.find((im: any) => im.variant_id && variantIdToColor.get(im.variant_id) === colorOf(v.name)) : null
        return {
          id: v.id,
          name: v.name,
          sku: v.sku,
          sale_price: Number(v.sale_price),
          cost_price: Number(v.cost_price ?? 0),
          image: ownImg?.url ?? colorImg?.url ?? null,
          stock: (v.stock_levels ?? []).reduce(
            (sum: number, sl: any) => sum + Number(sl.quantity_available ?? 0), 0
          ),
        }
      }),
    }
  }).filter((p: any) => p.variants.length > 0)

  return (
    <POSClient
      orgId={orgId}
      userId={user.id}
      initialProducts={products}
      initialCustomers={customers ?? []}
      bankDetails={bankDetails}
    />
  )
}
