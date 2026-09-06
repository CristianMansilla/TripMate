import type { TripRole, TripStatus } from './types'

export function tripRoleLabel(role:TripRole|'demo'|null|undefined){
  return ({owner:'Dueño',editor:'Editor',viewer:'Lector',demo:'Demostración'} as const)[role || 'demo']
}

export function tripStatusLabel(status:TripStatus){
  return ({planning:'En planificación',active:'En curso',completed:'Finalizado'} as const)[status]
}

export function changeActionLabel(action:string){
  const labels:Record<string,string>={
    created:'Creado',updated:'Actualizado',deleted:'Eliminado',removed:'Eliminado',
    joined:'Se unió',invited:'Invitado',restored:'Restaurado',archived:'Archivado',
  }
  return labels[action.toLowerCase()] || 'Cambio realizado'
}

export function userFacingError(error:unknown,fallback='No pudimos completar la acción. Intentá nuevamente.'){
  const message=error instanceof Error
    ? error.message
    : typeof error==='string'
      ? error
      : error && typeof error==='object' && 'message' in error && typeof error.message==='string'
        ? error.message
        : ''
  const normalized=message.toLowerCase()
  const translations:[string,string][]=[
    ['invalid login credentials','El email, usuario o la contraseña no son correctos.'],
    ['email not confirmed','Confirmá tu email antes de iniciar sesión.'],
    ['user already registered','Ya existe una cuenta con ese email.'],
    ['email address is invalid','Ingresá un email válido.'],
    ['unable to validate email address','Ingresá un email válido.'],
    ['password should be at least','La contraseña no cumple la longitud mínima.'],
    ['new password should be different','La contraseña nueva debe ser diferente de la anterior.'],
    ['auth session missing','Tu sesión venció. Volvé a iniciar sesión.'],
    ['email rate limit exceeded','Se enviaron demasiados emails. Esperá unos minutos e intentá nuevamente.'],
    ['rate limit','Se realizaron demasiados intentos. Esperá unos minutos.'],
    ['invalid invite','La invitación no es válida.'],
    ['invite expired','La invitación venció.'],
    ['invite exhausted','La invitación alcanzó su límite de usos.'],
    ['duplicate key','Ya existe un registro con esos datos.'],
    ['failed to fetch','No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.'],
    ['network','No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.'],
  ]
  const translated=translations.find(([pattern])=>normalized.includes(pattern))
  if(translated)return translated[1]
  if(/^(no |el |la |los |las |tu |se |configurá|supabase )/i.test(message))return message
  return fallback
}
