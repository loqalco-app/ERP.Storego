import { createServerClient } from '@supabase/ssr'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, role, orgId, invitedBy } = await request.json()

  if (!email || !role || !orgId) {
    return NextResponse.json({ error: 'email, role y orgId son requeridos.' }, { status: 400 })
  }

  const validRoles = ['admin', 'staff', 'viewer']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  // Verify caller is admin/owner of the org
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.organization_id !== orgId || !['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos para invitar usuarios.' }, { status: 403 })
  }

  // Check if invitation already exists
  const { data: existing } = await supabase
    .from('organization_invitations')
    .select('id, status')
    .eq('organization_id', orgId)
    .eq('email', email.toLowerCase())
    .in('status', ['pending'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Ya existe una invitación pendiente para ese correo.' }, { status: 409 })
  }

  // Check if user already member
  const { data: member } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('organization_id', orgId)
    .eq('id', (await supabase.from('user_profiles').select('id').eq('organization_id', orgId)).data?.map(r => r.id) as unknown as string)
    .maybeSingle()

  // Create invitation record first
  const { error: invErr } = await supabase
    .from('organization_invitations')
    .insert({ organization_id: orgId, email: email.toLowerCase(), role, invited_by: user.id })

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 400 })
  }

  // If service role key is available, send via Supabase admin invite
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey) {
    const adminClient = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      email.toLowerCase(),
      { data: { org_id: orgId, role } }
    )
    if (inviteErr) {
      // Rollback invitation record
      await supabase.from('organization_invitations')
        .update({ status: 'cancelled' })
        .eq('organization_id', orgId).eq('email', email.toLowerCase()).eq('status', 'pending')
      return NextResponse.json({ error: inviteErr.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, method: 'email' })
  }

  // Fallback: return invite link (user copies manually)
  return NextResponse.json({ ok: true, method: 'manual', note: 'Agrega SUPABASE_SERVICE_ROLE_KEY para enviar correos automáticos.' })
}

export async function DELETE(request: Request) {
  const { invitationId, orgId } = await request.json()

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { error } = await supabase
    .from('organization_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId)
    .eq('organization_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
