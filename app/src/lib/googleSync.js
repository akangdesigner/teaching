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
    console.warn('[googleSync]', e.message)
  }
}
