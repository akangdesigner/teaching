import { Router } from 'express'
import { supabase } from '../services/supabase.js'
import { upsertEvent, deleteEvent } from '../services/googleCalendar.js'

const router = Router()

// 驗證 JWT，回傳 user
async function authenticate(req, res) {
  const jwt = req.headers.authorization?.replace('Bearer ', '')
  if (!jwt) { res.status(401).json({ error: 'Unauthorized' }); return null }
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) { res.status(401).json({ error: 'Unauthorized' }); return null }
  return user
}

// 同步單一事件到 Google Calendar
// POST /api/google/sync-event
// body: { type: 'session'|'client', id, action: 'upsert'|'delete' }
router.post('/sync-event', async (req, res) => {
  const user = await authenticate(req, res)
  if (!user) return

  // 檢查用戶是否已連結 Google
  const { data: profile } = await supabase
    .from('profiles')
    .select('google_refresh_token')
    .eq('id', user.id)
    .single()

  if (!profile?.google_refresh_token) return res.json({ ok: true, skipped: true })

  const { type, id, action } = req.body

  try {
    if (type === 'session') {
      if (action === 'delete') {
        const { data: session } = await supabase.from('sessions').select('google_event_id').eq('id', id).single()
        if (session?.google_event_id) await deleteEvent(user.id, session.google_event_id)
        await supabase.from('sessions').update({ google_event_id: null }).eq('id', id)
      } else {
        const { data: session } = await supabase
          .from('sessions')
          .select('*, clients(name)')
          .eq('id', id)
          .single()

        if (!session?.date) return res.json({ ok: true, skipped: true })

        const event = await upsertEvent(user.id, {
          googleEventId: session.google_event_id,
          summary: `${session.clients.name} — 第 ${session.session_number} 堂課`,
          description: session.objectives || '',
          startIso: session.date,
        })

        await supabase.from('sessions').update({ google_event_id: event.id }).eq('id', id)
      }
    } else if (type === 'client') {
      // 同步 next_session_date 事件
      if (action === 'delete') {
        const { data: client } = await supabase.from('clients').select('google_event_id').eq('id', id).single()
        if (client?.google_event_id) await deleteEvent(user.id, client.google_event_id)
        await supabase.from('clients').update({ google_event_id: null }).eq('id', id)
      } else {
        const { data: client } = await supabase
          .from('clients')
          .select('name, next_session_date, current_stage, google_event_id')
          .eq('id', id)
          .single()

        if (!client?.next_session_date) {
          // 若清掉了上課時間，也刪掉 Google 事件
          if (client?.google_event_id) {
            await deleteEvent(user.id, client.google_event_id)
            await supabase.from('clients').update({ google_event_id: null }).eq('id', id)
          }
          return res.json({ ok: true, skipped: true })
        }

        const event = await upsertEvent(user.id, {
          googleEventId: client.google_event_id,
          summary: `${client.name} — 下次課程`,
          description: '',
          startIso: client.next_session_date,
        })

        await supabase.from('clients').update({ google_event_id: event.id }).eq('id', id)
      }
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('[google] sync-event error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

export default router
