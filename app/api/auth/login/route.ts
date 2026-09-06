import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const invalidCredentials = 'El email, usuario o la contraseña no son correctos.'

export async function POST(request: Request) {
  let body: { identifier?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: invalidCredentials }, { status: 400 })
  }

  const identifier = body.identifier?.trim().toLowerCase() || ''
  const password = body.password || ''
  if (!identifier || !password) {
    return NextResponse.json({ message: invalidCredentials }, { status: 400 })
  }

  let email = identifier
  if (!identifier.includes('@')) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ message: 'El ingreso por usuario todavía no está configurado.' }, { status: 503 })
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data } = await admin.rpc('resolve_login_identifier', { p_identifier: identifier })
    if (typeof data !== 'string' || !data) {
      return NextResponse.json({ message: invalidCredentials }, { status: 400 })
    }
    email = data
  }

  const supabase = await createServerSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ message: 'Supabase no está configurado.' }, { status: 503 })
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return NextResponse.json({ message: invalidCredentials }, { status: 400 })
  return NextResponse.json({ ok: true })
}
