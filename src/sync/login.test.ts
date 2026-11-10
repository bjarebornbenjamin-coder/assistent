import { describe, expect, it } from 'vitest'
import { loginError } from './LoginForm'

describe('inloggningsfel på svenska', () => {
  it('översätter de vanligaste felen och behåller okända', () => {
    expect(loginError('Invalid login credentials')).toBe('Fel e-post eller lösenord.')
    expect(loginError('Signups not allowed for this instance')).toMatch(/nya konton/)
    expect(loginError('User already registered')).toMatch(/Logga in i stället/)
    expect(loginError('Något annat')).toBe('Något annat')
  })
})

describe('miljövariabler', async () => {
  const { cleanEnv } = await import('./supabase')
  it('tar bort mellanslag, radbrytning och citattecken', () => {
    expect(cleanEnv(' "sb_publishable_abc" \n')).toBe('sb_publishable_abc')
    expect(cleanEnv('   ')).toBeUndefined()
    expect(cleanEnv(undefined)).toBeUndefined()
  })
})
