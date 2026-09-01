import { createServerClient } from '@supabase/ssr'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  staff: 'Staff',
  viewer: 'Lector',
}

function inviteEmailHtml(opts: {
  orgName: string
  invitedByName: string
  role: string
  inviteUrl: string
}) {
  const roleLabel = ROLE_LABELS[opts.role] ?? opts.role
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invitación a ${opts.orgName}</title>
</head>
<body style="margin:0;padding:0;background:#ECEEF2;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#ECEEF2;padding:40px 16px 60px;">
  <tr><td align="center">

    <!-- Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ECEEF2;border-radius:28px;overflow:hidden;box-shadow:8px 8px 24px rgba(0,0,0,0.10),-6px -6px 16px rgba(255,255,255,0.95),inset 0 1px 0 rgba(255,255,255,0.7);">

      <!-- Header azul -->
      <tr>
        <td style="background:linear-gradient(145deg,#1D4ED8,#2563EB,#3B82F6);padding:36px 40px 32px;text-align:center;position:relative;">
          <!-- Logo S -->
          <div style="display:inline-flex;width:52px;height:52px;background:rgba(255,255,255,0.18);border:1.5px solid rgba(255,255,255,0.28);border-radius:16px;align-items:center;justify-content:center;margin-bottom:16px;">
            <span style="font-size:26px;font-weight:900;color:white;line-height:1;display:inline-block;margin-top:0;">S</span>
          </div>
          <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.70);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">Store ERP</div>
          <div style="font-size:26px;font-weight:800;color:white;letter-spacing:-0.5px;line-height:1.2;">Te invitaron a unirte</div>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:36px 40px 32px;">

          <!-- Org pill -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;background:rgba(29,78,216,0.10);border-radius:50px;padding:10px 20px;">
            <tr>
              <td style="font-size:15px;font-weight:700;color:#1D4ED8;text-align:center;">${opts.orgName}</td>
            </tr>
          </table>

          <p style="font-size:15px;line-height:1.6;color:#0A0A0E;margin:0 0 8px;text-align:center;">
            <strong>${opts.invitedByName}</strong> te ha invitado a colaborar en
          </p>
          <p style="font-size:15px;line-height:1.6;color:rgba(10,10,14,0.55);margin:0 0 28px;text-align:center;">
            Tu rol será:
          </p>

          <!-- Role badge -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;background:rgba(29,78,216,0.10);border-radius:50px;padding:10px 24px;">
            <tr>
              <td style="font-size:14px;font-weight:700;color:#1D4ED8;text-align:center;">${roleLabel}</td>
            </tr>
          </table>

          <!-- CTA Button -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="background:linear-gradient(145deg,#1D4ED8,#2563EB);border-radius:50px;box-shadow:0 8px 24px rgba(29,78,216,0.32);">
                <a href="${opts.inviteUrl}" style="display:inline-block;padding:16px 40px;font-size:16px;font-weight:700;color:white;text-decoration:none;border-radius:50px;letter-spacing:-0.1px;">
                  Aceptar invitación →
                </a>
              </td>
            </tr>
          </table>

          <!-- Expiry note -->
          <p style="font-size:12px;color:rgba(10,10,14,0.35);text-align:center;margin:24px 0 0;line-height:1.5;">
            Este enlace expira en 7 días.<br>Si no esperabas esta invitación, puedes ignorar este correo.
          </p>

        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:0 40px 32px;border-top:1px solid rgba(0,0,0,0.05);">
          <p style="font-size:11px;color:rgba(10,10,14,0.30);text-align:center;margin:24px 0 0;line-height:1.6;">
            Store ERP · Sistema de gestión comercial<br>
            Este correo fue enviado a solicitud de un administrador de ${opts.orgName}.
          </p>
        </td>
      </tr>

    </table>
    <!-- /Card -->

  </td></tr>
</table>
</body>
</html>`
}

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

  const invitedByName = (callerProfile as { full_name?: string }).full_name ?? user.email?.split('@')[0] ?? 'Un administrador'

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado en Vercel.' }, { status: 500 })
  }

  const adminClient = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Check pending invite
  const { data: existing } = await supabase
    .from('organization_invitations')
    .select('id')
    .eq('organization_id', orgId)
    .eq('email', email.toLowerCase())
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Ya hay una invitación pendiente para ese correo.' }, { status: 409 })
  }

  // Get org name for email
  const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
  const orgName = (org as { name?: string } | null)?.name ?? 'Mi organización'

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const resendKey = process.env.RESEND_API_KEY

  // ── Camino A: Resend — generamos link personalizado y enviamos email ──
  if (resendKey) {
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
      organization_id: orgId, email: email.toLowerCase(),
      role, invited_by: user.id, full_name: fullName ?? null,
    })

    const resend = new Resend(resendKey)
    const { error: emailErr } = await resend.emails.send({
      from: 'Store ERP <onboarding@resend.dev>',
      to: email.toLowerCase(),
      subject: `${invitedByName} te invitó a ${orgName}`,
      html: inviteEmailHtml({ orgName, invitedByName, role, inviteUrl: linkData.properties.action_link }),
    })
    if (emailErr) {
      return NextResponse.json({ error: 'Invitación creada pero error al enviar correo: ' + emailErr.message }, { status: 207 })
    }
    return NextResponse.json({ ok: true, method: 'resend' })
  }

  // ── Camino B: sin Resend — usamos inviteUserByEmail que SÍ envía el email automáticamente ──
  const { error: invErr } = await adminClient.auth.admin.inviteUserByEmail(email.toLowerCase(), {
    data: { org_id: orgId, role, full_name: fullName ?? '' },
    options: { redirectTo: `${appUrl}/auth/setup-password` },
  } as Parameters<typeof adminClient.auth.admin.inviteUserByEmail>[1])

  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 400 })
  }

  await supabase.from('organization_invitations').insert({
    organization_id: orgId, email: email.toLowerCase(),
    role, invited_by: user.id, full_name: fullName ?? null,
  })

  return NextResponse.json({ ok: true, method: 'supabase_default' })
}

export async function DELETE(request: Request) {
  const { invitationId, orgId } = await request.json()
  if (!invitationId || !orgId) {
    return NextResponse.json({ error: 'Faltan parámetros.' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Config incompleta.' }, { status: 500 })

  // Verificar sesión
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  // adminClient bypasea RLS — no depende de políticas de la tabla
  const adminClient = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await adminClient
    .from('organization_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId)
    .eq('organization_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
