import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
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
]

export default function CalendarPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('id, name, current_stage, next_session_date'),
      supabase.from('consultations').select('id, client_id, date'),
      supabase.from('sessions').select('id, client_id, date, session_number'),
    ]).then(([{ data: clients }, { data: consultations }, { data: sessions }]) => {
      const now = new Date()
      const clientMap = Object.fromEntries((clients ?? []).map(c => [c.id, c]))
      const evts = []

      // upcoming next_session_date per client
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

      // consultations → gray
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

      // sessions → gray
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

      setEvents(evts)
      setLoading(false)
    })
  }, [])

  function eventStyleGetter(event) {
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
    navigate(`/clients/${event.resource.clientId}`)
  }

  return (
    <div>
      <Navbar />
      <main className="max-w-6xl mx-auto px-8 py-10">

        {/* Header */}
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
                events={events}
                startAccessor="start"
                endAccessor="end"
                culture="zh-TW"
                messages={messages}
                eventPropGetter={eventStyleGetter}
                onSelectEvent={onSelectEvent}
                views={['month', 'week', 'agenda']}
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
