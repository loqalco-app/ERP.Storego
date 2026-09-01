import { createServerClient } from '@supabase/ssr'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function getCallerAndAdmin(orgId: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return { error: 'SUPABASE_SERVICE_ROLE_KEY no configurado.', status: 500 }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.', status: 401 }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.organization_id !== orgId || !['owner', 'admin'].includes(profile.role ?? '')) {
    return { error: 'Sin permisos.', status: 403 }
  }

  const adminClient = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  return { caller: { id: user.id, role: profile.role }, adminClient, supabase }
}

const VALID_MODULES = ['dashboard', 'pos', 'finanzas', 'orders', 'catalog', 'customers']

// PATCH /api/team/member — edit name, role, and/or allowed_modules
export async function PATCH(request: Request) {
  const { memberId, fullName, role, orgId, allowedModules } = await request.json()
  if (!memberId || !orgId) return NextResponse.json({ error: 'Faltan campos.' }, { status: 400 })
  if (role && !['admin', 'staff', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 })
  }
  if (allowedModules !== undefined && allowedModules !== null) {
    if (!Array.isArray(allowedModules) || allowedModules.some((m: string) => !VALID_MODULES.includes(m))) {
      return NextResponse.json({ error: 'Módulos inválidos.' }, { status: 400 })
    }
  }

  const ctx = await getCallerAndAdmin(orgId)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { caller, adminClient } = ctx

  // Cannot edit owner unless caller is owner
  const { data: targetProfile } = await adminClient
    .from('user_profiles')
    .select('role, organization_id')
    .eq('id', memberId)
    .single()

  if (!targetProfile || targetProfile.organization_id !== orgId) {
    return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
  }
  if (targetProfile.role === 'owner' && caller.role !== 'owner') {
    return NextResponse.json({ error: 'No puedes editar al propietario.' }, { status: 403 })
  }
  if (memberId === caller.id) {
    return NextResponse.json({ error: 'No puedes editarte a ti mismo aquí.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (fullName?.trim()) updates.full_name = fullName.trim()
  if (role) updates.role = role
  if (allowedModules !== undefined) updates.allowed_modules = allowedModules

  const { error } = await adminClient
    .from('user_profiles')
    .update(updates)
    .eq('id', memberId)
    .eq('organization_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/team/member — remove user from auth + profiles
export async function DELETE(request: Request) {
  const { memberId, orgId } = await request.json()
  if (!memberId || !orgId) return NextResponse.json({ error: 'Faltan campos.' }, { status: 400 })

  const ctx = await getCallerAndAdmin(orgId)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { caller, adminClient } = ctx

  if (memberId === caller.id) {
    return NextResponse.json({ error: 'No puedes eliminarte a ti mismo.' }, { status: 400 })
  }

  // Verify target belongs to org and is not owner
  const { data: targetProfile } = await adminClient
    .from('user_profiles')
    .select('role, organization_id')
    .eq('id', memberId)
    .single()

  if (!targetProfile || targetProfile.organization_id !== orgId) {
    return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 })
  }
  if (targetProfile.role === 'owner') {
    return NextResponse.json({ error: 'No puedes eliminar al propietario.' }, { status: 403 })
  }

  // Delete from auth (cascades to user_profiles via FK or RLS)
  const { error } = await adminClient.auth.admin.deleteUser(memberId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
