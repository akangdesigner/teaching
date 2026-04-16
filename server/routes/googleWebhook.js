import { Router } from 'express'
import { supabase } from '../services/supabase.js'
import { fetchChangedEvents } from '../services/googleCalendar.js'

const router = Router()

// Google Calendar push notification
// POST /webhook/google-calendar
router.post('/', async (req, res) => {
  // 立刻回 200，避免 Google 重試
  res.sendStatus(200)

  const state = req.headers['x-goog-resource-state']
  const userId = req.headers['x-goog-channel-token']

  // 'sync' 是初始握手，忽略
  if (state === 'sync' || !userId) return

  try {
    const events = await fetchChangedEvents(userId)

    for (const event of events) {
      if (event.status === 'cancelled') continue
      if (!event.start?.dateTime) continue

      const newStart = event.start.dateTime

      // 找看看是哪個 session
      const { data: session } = await supabase
        .from('sessions')
        .select('id, date')
        .eq('google_event_id', event.id)
        .eq('user_id', userId)
        .single()

      if (session) {
        if (session.date !== newStart) {
          await supabase.from('sessions')
            .update({ date: newStart })
            .eq('id', session.id)
          console.log(`[google→db] session ${session.id} 時間更新為 ${newStart}`)
        }
        continue
      }

      // 找看看是哪個 client 的 next_session_date
      const { data: client } = await supabase
        .from('clients')
        .select('id, next_session_date')
        .eq('google_event_id', event.id)
        .eq('user_id', userId)
        .single()

      if (client && client.next_session_date !== newStart) {
        await supabase.from('clients')
          .update({ next_session_date: newStart })
          .eq('id', client.id)
        console.log(`[google→db] client ${client.id} next_session_date 更新為 ${newStart}`)
      }
    }
  } catch (e) {
    console.error('[google webhook] error:', e.message)
  }
})

export default router
