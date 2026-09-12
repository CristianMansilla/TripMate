import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { loginClientAddress, loginRateLimiter } from '@/lib/login-rate-limit'

const invalidCredentials = 'El email, usuario o la contraseña no son correctos.'
const MAX_BODY_LENGTH = 4_096

function response(message: string, status: number, retryAfterSeconds?: number) {
  return NextResponse.json(
    { message },
    {
      status,
      headers: {
        'Cache-Control': 'private, no-store',
        ...(retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : {}),
      },
    },
  )
}

function limitedResponse(retryAfterSeconds: number) {
  return response('Demasiados intentos. Esperá unos minutos antes de volver a ingresar.', 429, retryAfterSeconds)
}

export async function POST(request: Request) {
  const address = loginClientAddress(request.headers)
  const initialLimit = loginRateLimiter.check(address)
  if (initialLimit.limited) return limitedResponse(initialLimit.retryAfterSeconds)

  let body: { identifier?: string; password?: string }
  try {
    const rawBody = await request.text()
    if (rawBody.length > MAX_BODY_LENGTH) throw new Error('Request body too large')
    body = JSON.parse(rawBody) as { identifier?: string; password?: string }
  } catch {
    const limit = loginRateLimiter.recordFailure(address)
    return limit.limited ? limitedResponse(limit.retryAfterSeconds) : response(invalidCredentials, 400)
  }

  const identifier = body.identifier?.trim().toLowerCase() || ''
  const password = body.password || ''
  if (!identifier || identifier.length > 254 || !password || password.length > 1_024) {
    const limit = loginRateLimiter.recordFailure(address, identifier)
    return limit.limited ? limitedResponse(limit.retryAfterSeconds) : response(invalidCredentials, 400)
  }

  const attemptLimit = loginRateLimiter.check(address, identifier)
  if (attemptLimit.limited) return limitedResponse(attemptLimit.retryAfterSeconds)

  let email = identifier
  if (!identifier.includes('@')) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return response('El ingreso por usuario todavía no está configurado.', 503)
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data } = await admin.rpc('resolve_login_identifier', { p_identifier: identifier })
    if (typeof data !== 'string' || !data) {
      const limit = loginRateLimiter.recordFailure(address, identifier)
      return limit.limited ? limitedResponse(limit.retryAfterSeconds) : response(invalidCredentials, 400)
    }
    email = data
  }

  const supabase = await createServerSupabaseClient()
  if (!supabase) {
    return response('Supabase no está configurado.', 503)
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    const limit = loginRateLimiter.recordFailure(address, identifier)
    return limit.limited ? limitedResponse(limit.retryAfterSeconds) : response(invalidCredentials, 400)
  }
  loginRateLimiter.clearSuccessfulPair(address, identifier)
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
}
