import { supabase } from './supabase'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''

async function getJwt() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

export async function syncEvent({ type, id, action = 'upsert' }) {
  if (!SERVER_URL) return
  try {
    const jwt = await getJwt()
    if (!jwt) return
    await fetch(`${SERVER_URL}/api/google/sync-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ type, id, action }),
    })
  } catch (e) {
    console.warn('[googleSync] sync failed:', e.message)
  }
}

export async function connectGoogle() {
  if (!SERVER_URL) throw new Error('VITE_SERVER_URL 未設定')
  const res = await fetch(`${SERVER_URL}/api/google/url`)
  const { url } = await res.json()
  window.location.href = url
}

export async function disconnectGoogle() {
  const jwt = await getJwt()
  const res = await fetch(`${SERVER_URL}/api/google/disconnect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
  })
  if (!res.ok) throw new Error('斷開連結失敗')
}

export async function exchangeGoogleCode(code) {
  const jwt = await getJwt()
  const res = await fetch(`${SERVER_URL}/api/google/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || '連結失敗')
  }
}
