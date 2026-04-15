import cron from 'node-cron'
import { supabase } from './supabase.js'
import { pushMessage } from './line.js'

const STAGE_LABEL = {
  preparation: '準備階段',
  stage1: '第一階段｜諮詢',
  stage2: '第二階段｜課程',
  stage3: '第三階段｜成果',
  completed: '已完成',
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: 'numeric', day: 'numeric',
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function isToday(iso) {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const n = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  return d.toDateString() === n.toDateString()
}

async function sendDailyReminders() {
  console.log('[reminder] Running daily reminder job...')

  // Get today and tomorrow boundaries in UTC
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const tomorrowEnd = new Date(todayStart)
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 2)

  // Fetch upcoming clients (all teachers)
  const { data: clients, error: clientErr } = await supabase
    .from('clients')
    .select('id, user_id, name, project_name, current_stage, next_session_date, situation')
    .gte('next_session_date', todayStart.toISOString())
    .lt('next_session_date', tomorrowEnd.toISOString())
    .order('next_session_date')

  if (clientErr) {
    console.error('[reminder] Failed to fetch clients:', clientErr.message)
    return
  }
  if (!clients || clients.length === 0) {
    console.log('[reminder] No upcoming sessions today/tomorrow.')
    return
  }

  // Get unique user_ids and their LINE IDs
  const userIds = [...new Set(clients.map(c => c.user_id))]
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, line_user_id')
    .in('id', userIds)
    .not('line_user_id', 'is', null)

  if (profileErr) {
    console.error('[reminder] Failed to fetch profiles:', profileErr.message)
    return
  }
  if (!profiles || profiles.length === 0) {
    console.log('[reminder] No teachers with LINE bound.')
    return
  }

  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.line_user_id]))

  // Fetch incomplete tasks for all upcoming clients
  const clientIds = clients.map(c => c.id)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('client_id, description')
    .in('client_id', clientIds)
    .eq('completed', false)

  const tasksByClient = {}
  for (const t of tasks ?? []) {
    if (!tasksByClient[t.client_id]) tasksByClient[t.client_id] = []
    tasksByClient[t.client_id].push(t.description)
  }

  // Group clients by teacher
  const byTeacher = {}
  for (const client of clients) {
    if (!byTeacher[client.user_id]) byTeacher[client.user_id] = []
    byTeacher[client.user_id].push(client)
  }

  // Send one message per teacher
  for (const [userId, teacherClients] of Object.entries(byTeacher)) {
    const lineId = profileMap[userId]
    if (!lineId) continue

    const todayList = teacherClients.filter(c => isToday(c.next_session_date))
    const tomorrowList = teacherClients.filter(c => !isToday(c.next_session_date))

    const lines = ['📚 課程提醒', '─────────────']

    if (todayList.length > 0) {
      lines.push(`\n【今日課程 × ${todayList.length}】`)
      for (const c of todayList) {
        const pending = tasksByClient[c.id] ?? []
        lines.push(`\n▸ ${c.name}`)
        lines.push(`  ${c.project_name ?? ''}`)
        lines.push(`  ${STAGE_LABEL[c.current_stage] ?? c.current_stage}`)
        lines.push(`  時間：${formatDateTime(c.next_session_date)}`)
        if (c.situation) lines.push(`  狀況：${c.situation}`)
        if (pending.length > 0) {
          lines.push(`  未完成作業（${pending.length}）：`)
          pending.slice(0, 3).forEach(t => lines.push(`    · ${t}`))
          if (pending.length > 3) lines.push(`    …還有 ${pending.length - 3} 項`)
        }
      }
    }

    if (tomorrowList.length > 0) {
      lines.push(`\n【明日課程 × ${tomorrowList.length}】`)
      for (const c of tomorrowList) {
        lines.push(`\n▸ ${c.name}  ${formatDateTime(c.next_session_date)}`)
        lines.push(`  ${STAGE_LABEL[c.current_stage] ?? c.current_stage}`)
      }
    }

    lines.push('\n─────────────')
    lines.push('傳「查詢 姓名」可查看學生詳細資料')

    try {
      await pushMessage(lineId, lines.join('\n'))
      console.log(`[reminder] Sent to teacher ${userId}`)
    } catch (err) {
      console.error(`[reminder] Failed to send to ${lineId}:`, err.message)
    }
  }
}

export function startReminderCron() {
  // Every day at 08:00 Asia/Taipei
  cron.schedule('0 8 * * *', sendDailyReminders, {
    timezone: 'Asia/Taipei'
  })
  console.log('[reminder] Cron job scheduled: daily at 08:00 Asia/Taipei')
}
