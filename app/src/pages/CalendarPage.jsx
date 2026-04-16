import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'zh-TW': zhTW },
})

const messages = {
  today: '今天',
  previous: '上一頁',
  next: '下一頁',
  month: '月',
  week: '週',
  day: '日',
  agenda: '清單',
  date: '日期',
  time: '時間',
  event: '事件',
  noEventsInRange: '這段期間沒有課程',
}

const STAGE_COLORS = {
  preparation: '#6b9e7c',
  stage1: '#7b93c4',
  stage2: '#d4a843',
  stage3: '#c47a58',
  completed: '#5a9e7a',
  past: '#4a4a5a',
}

const LEGEND = [
  { label: '即將上課', color: '#7b93c4' },
  { label: '已上課', color: '#4a4a5a' },
  { label: 'Google Calendar', color: '#8b6fba' },
]

async function fetchGoogleEvents(timeMin, timeMax) {
  try {
    let { data } = await supabase.auth.getSession()
    let token = data.session?.provider_token

    if (!token) {
      const { data: refreshed } = await supabase.auth.refreshSession()
      token = refreshed.session?.provider_token
    }
    if (!token) return []

    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return []

    const result = await res.json()
    return (result.items || []).filter(e => e.status !== 'cancelled' && (e.start?.dateTime || e.start?.date))
  } catch {
    return []
  }
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const [dbEvents, setDbEvents] = useState([])
  const [googleEvents, setGoogleEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  // 載入 Supabase 資料
  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('id, name, current_stage, next_session_date'),
      supabase.from('consultations').select('id, client_id, date'),
      supabase.from('sessions').select('id, client_id, date, session_number'),
    ]).then(([{ data: clients }, { data: consultations }, { data: sessions }]) => {
      const now = new Date()
      const clientMap = Object.fromEntries((clients ?? []).map(c => [c.id, c]))
      const evts = []

      for (const c of (clients ?? [])) {
        if (!c.next_session_date) continue
        const start = new Date(c.next_session_date)
        if (start >= now) {
          evts.push({
            id: `next-${c.id}`,
            title: c.name,
            start,
            end: new Date(start.getTime() + 60 * 60 * 1000),
            resource: { type: 'upcoming', clientId: c.id, stage: c.current_stage },
          })
        }
      }

      for (const con of (consultations ?? [])) {
        if (!con.date) continue
        const client = clientMap[con.client_id]
        if (!client) continue
        evts.push({
          id: `con-${con.id}`,
          title: `${client.name} 諮詢`,
          start: new Date(con.date),
          end: new Date(new Date(con.date).getTime() + 30 * 60 * 1000),
          resource: { type: 'past', clientId: con.client_id, stage: client.current_stage },
        })
      }

      for (const s of (sessions ?? [])) {
        if (!s.date) continue
        const client = clientMap[s.client_id]
        if (!client) continue
        evts.push({
          id: `session-${s.id}`,
          title: `${client.name} 課程`,
          start: new Date(s.date),
          end: new Date(new Date(s.date).getTime() + 60 * 60 * 1000),
          resource: { type: 'past', clientId: s.client_id, stage: client.current_stage },
        })
      }

      setDbEvents(evts)
      setLoading(false)
    })
  }, [])

  // 載入 Google Calendar 事件（隨月份變動）
  const loadGoogleEvents = useCallback(async (date) => {
    const timeMin = subMonths(startOfMonth(date), 0)
    const timeMax = addMonths(endOfMonth(date), 0)
    const items = await fetchGoogleEvents(timeMin, timeMax)

    const evts = items.map(e => {
      const isAllDay = !!e.start.date
      const start = isAllDay ? new Date(e.start.date + 'T00:00:00') : new Date(e.start.dateTime)
      const end = isAllDay ? new Date(e.end.date + 'T00:00:00') : new Date(e.end.dateTime)
      return {
        id: `google-${e.id}`,
        title: e.summary || '(無標題)',
        start,
        end,
        allDay: isAllDay,
        resource: { type: 'google' },
      }
    })
    setGoogleEvents(evts)
  }, [])

  useEffect(() => {
    loadGoogleEvents(currentDate)
  }, [currentDate, loadGoogleEvents])

  function eventStyleGetter(event) {
    if (event.resource.type === 'google') {
      return {
        style: {
          backgroundColor: '#8b6fba22',
          border: '1px solid #8b6fba66',
          borderRadius: '2px',
          color: '#8b6fba',
          fontSize: '11px',
          fontFamily: "'IBM Plex Mono', monospace",
          padding: '2px 6px',
        },
      }
    }
    const isPast = event.resource.type === 'past'
    const color = isPast ? STAGE_COLORS.past : (STAGE_COLORS[event.resource.stage] ?? '#7b93c4')
    return {
      style: {
        backgroundColor: color + '22',
        border: `1px solid ${color}66`,
        borderRadius: '2px',
        color: color,
        fontSize: '11px',
        fontFamily: "'IBM Plex Mono', monospace",
        padding: '2px 6px',
      },
    }
  }

  function onSelectEvent(event) {
    if (event.resource.type === 'google') return
    navigate(`/clients/${event.resource.clientId}`)
  }

  const allEvents = [...dbEvents, ...googleEvents]

  return (
    <div>
      <Navbar />
      <main className="max-w-6xl mx-auto px-8 py-10">

        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl font-medium text-foreground tracking-tight">課程日曆</h1>
          <div className="flex gap-6">
            {LEGEND.map(({ label, color }) => (
              <span key={label} className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {loading
          ? <p className="text-center text-muted-foreground font-mono text-sm py-20">載入中...</p>
          : (
            <div className="border border-border p-1" style={{ height: 700 }}>
              <Calendar
                localizer={localizer}
                events={allEvents}
                startAccessor="start"
                endAccessor="end"
                culture="zh-TW"
                messages={messages}
                eventPropGetter={eventStyleGetter}
                onSelectEvent={onSelectEvent}
                views={['month', 'agenda']}
                defaultView="month"
                date={currentDate}
                onNavigate={date => setCurrentDate(date)}
                popup
              />
            </div>
          )
        }
      </main>
    </div>
  )
}
