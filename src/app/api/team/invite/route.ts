import { createServerClient } from '@supabase/ssr'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, role, orgId, fullName } = await request.json()

  if (!email || !role || !orgId) {
    return NextResponse.json({ error: 'email, role y orgId son requeridos.' }, { status: 400 })
  }
  if (!['admin', 'staff', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('user_profiles')
    .select('role, organization_id, full_name')
    .eq('id', user.id)
    .single()

  const callerRole = (callerProfile as { role?: string } | null)?.role ?? 'owner'
  if (!callerProfile || callerProfile.organization_id !== orgId || !['owner', 'admin'].includes(callerRole)) {
    return NextResponse.json({ error: 'Sin permisos para invitar usuarios.' }, { status: 403 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado en Vercel.' }, { status: 500 })
  }

  const adminClient = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verificar que no haya invitación pendiente para este correo
  const { data: existing } = await supabase
    .from('organization_invitations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('email', email.toLowerCase())
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Ya hay un acceso pendiente para ese correo.' }, { status: 409 })
  }

  // Usar el origin del request — siempre es el dominio correcto en producción
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL
    || request.headers.get('origin')
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // Generar link de invite (single-use, no envía correo)
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: email.toLowerCase(),
    options: {
      data: { org_id: orgId, role, full_name: fullName ?? '' },
      redirectTo: `${appUrl}/auth/setup-password`,
    },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json({ error: linkErr?.message ?? 'No se pudo generar el enlace.' }, { status: 400 })
  }

  await supabase.from('organization_invitations').insert({
    organization_id: orgId,
    email: email.toLowerCase(),
    role,
    invited_by: user.id,
    full_name: fullName ?? null,
  })

  return NextResponse.json({ ok: true, link: linkData.properties.action_link })
}

export async function DELETE(request: Request) {
  const { invitationId, orgId } = await request.json()
  if (!invitationId || !orgId) {
    return NextResponse.json({ error: 'Faltan parámetros.' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Config incompleta.' }, { status: 500 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  const adminClient = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await adminClient
    .from('organization_invitations')
    .delete()
    .eq('id', invitationId)
    .eq('organization_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
