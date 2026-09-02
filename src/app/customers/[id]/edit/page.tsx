import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import CustomerForm from '../../CustomerForm'

export default async function CustomerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('full_name, organization_id, organizations(name)').eq('id', user.id).single()

  const orgId = profile?.organization_id

  const { data: customer } = await supabase
    .from('customers')
    .select('id, full_name, email, phone, tax_id, notes, status, credit_limit, balance_owing, tags')
    .eq('id', id).eq('organization_id', orgId).single()

  if (!customer) notFound()

  const userName = profile?.full_name && !profile.full_name.includes('@')
    ? profile.full_name : (user.email?.split('@')[0] ?? 'Usuario')
  const orgName = (profile?.organizations as unknown as { name: string } | null)?.name ?? 'NORTHÉA'

  return (
    <CustomerForm
      mode="edit"
      orgId={orgId}
      userId={user.id}
      userName={userName}
      orgName={orgName}
      customerId={id}
      initial={{
        fullName: customer.full_name,
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        taxId: customer.tax_id ?? '',
        notes: customer.notes ?? '',
        status: customer.status,
        creditLimit: String(customer.credit_limit),
      }}
    />
  )
}
