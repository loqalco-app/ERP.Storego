import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeamClient from './TeamClient'

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Query without role first (migration 003 might not be run yet)
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('organization_id, organizations(name)')
    .eq('id', user.id)
    .single()

  if (!profile || profileErr) redirect('/dashboard')

  const orgId = profile.organization_id
  const orgName = (profile.organizations as unknown as { name: string } | null)?.name ?? 'Mi organización'

  // Try to get role (requires migration 003)
  const { data: profileWithRole } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const myRole = (profileWithRole as { role?: string } | null)?.role ?? 'owner'

  // Get all members — role column may not exist yet
  const { data: members } = await supabase
    .from('user_profiles')
    .select('id, full_name, avatar_url, role, status, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  // Get pending invitations — table may not exist yet
  const { data: invitations } = await supabase
    .from('organization_invitations')
    .select('id, email, role, status, created_at, expires_at')
    .eq('organization_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const migrationNeeded = !members?.[0]?.hasOwnProperty('role') && members && members.length > 0

  return (
    <TeamClient
      orgId={orgId}
      orgName={orgName}
      myUserId={user.id}
      myRole={myRole}
      myEmail={user.email ?? ''}
      members={(members ?? []).map(m => ({ ...m, role: (m as { role?: string }).role ?? 'staff' }))}
      invitations={invitations ?? []}
      migrationNeeded={!invitations && !profileWithRole}
    />
  )
}
