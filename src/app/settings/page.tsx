import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Una sola query: perfil + rol + org
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, phone, avatar_url, organization_id, role, organizations(name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/dashboard')

  const orgId   = profile.organization_id
  const orgName = (profile.organizations as unknown as { name: string } | null)?.name ?? 'Store ERP'
  const myRole  = (profile as unknown as { role?: string }).role ?? 'owner'

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, full_name, avatar_url, role, status, created_at, allowed_modules')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true }),
    supabase
      .from('organization_invitations')
      .select('id, email, role, status, created_at, expires_at')
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ])

  const migrationNeeded = !invitations

  return (
    <SettingsClient
      initialTab={params.tab === 'team' ? 'team' : 'profile'}
      userId={user.id}
      email={user.email ?? ''}
      fullName={profile.full_name ?? ''}
      phone={profile.phone ?? ''}
      orgId={orgId}
      orgName={orgName}
      myUserId={user.id}
      myRole={myRole}
      myEmail={user.email ?? ''}
      members={(members ?? []).map(m => ({ ...m, role: (m as { role?: string }).role ?? 'staff' }))}
      invitations={invitations ?? []}
      migrationNeeded={migrationNeeded}
    />
  )
}
