import { supabase } from './supabase'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

async function getProviderToken() {
  // 嘗試取得目前 session 的 provider_token
  let { data } = await supabase.auth.getSession()
  if (data.session?.provider_token) return data.session.provider_token

  // 若過期，重新 refresh session 拿新的 provider_token
  const { data: refreshed } = await supabase.auth.refreshSession()
  return refreshed.session?.provider_token ?? null
}

async function calendarFetch(method, path, body) {
  const token = await getProviderToken()
  if (!token) return null

  const res = await fetch(`${CALENDAR_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Google API ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

function buildEventBody(summary, description, startIso) {
  const start = new Date(startIso)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  return {
    summary,
    description: description || '',
    start: { dateTime: start.toISOString(), timeZone: 'Asia/Taipei' },
    end: { dateTime: end.toISOString(), timeZone: 'Asia/Taipei' },
  }
}

async function upsertCalendarEvent({ googleEventId, summary, description, startIso }) {
  const body = buildEventBody(summary, description, startIso)
  if (googleEventId) {
    return calendarFetch('PATCH', `/calendars/primary/events/${googleEventId}`, body)
  }
  return calendarFetch('POST', '/calendars/primary/events', body)
}

async function deleteCalendarEvent(googleEventId) {
  if (!googleEventId) return
  try {
    await calendarFetch('DELETE', `/calendars/primary/events/${googleEventId}`)
  } catch (e) {
    if (!e.message.includes('410') && !e.message.includes('404')) throw e
  }
}

// 主要對外接口：同步 session 或 client 的 next_session_date 到 Google Calendar
export async function syncEvent({ type, id, action = 'upsert' }) {
  try {
    const token = await getProviderToken()
    if (!token) return // 用戶未用 Google 登入，跳過

    if (type === 'session') {
      if (action === 'delete') {
        const { data: s } = await supabase.from('sessions').select('google_event_id').eq('id', id).single()
        if (s?.google_event_id) await deleteCalendarEvent(s.google_event_id)
        await supabase.from('sessions').update({ google_event_id: null }).eq('id', id)
      } else {
        const { data: s } = await supabase
          .from('sessions').select('*, clients(name)').eq('id', id).single()
        if (!s?.date) return

        const event = await upsertCalendarEvent({
          googleEventId: s.google_event_id,
          summary: `${s.clients.name} — 第 ${s.session_number} 堂課`,
          description: s.objectives || '',
          startIso: s.date,
        })
        if (event?.id) await supabase.from('sessions').update({ google_event_id: event.id }).eq('id', id)
      }
    } else if (type === 'client') {
      if (action === 'delete') {
        const { data: c } = await supabase.from('clients').select('google_event_id').eq('id', id).single()
        if (c?.google_event_id) await deleteCalendarEvent(c.google_event_id)
        await supabase.from('clients').update({ google_event_id: null }).eq('id', id)
      } else {
        const { data: c } = await supabase
          .from('clients').select('name, next_session_date, google_event_id').eq('id', id).single()

        if (!c?.next_session_date) {
          if (c?.google_event_id) {
            await deleteCalendarEvent(c.google_event_id)
            await supabase.from('clients').update({ google_event_id: null }).eq('id', id)
          }
          return
        }

        const event = await upsertCalendarEvent({
          googleEventId: c.google_event_id,
          summary: `${c.name} — 下次課程`,
          description: '',
          startIso: c.next_session_date,
        })
        if (event?.id) await supabase.from('clients').update({ google_event_id: event.id }).eq('id', id)
      }
    }
  } catch (e) {
    console.warn('[googleSync]', e.message)
  }
}
