import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '@/components/Navbar'
import { supabase } from '@/lib/supabase'
import { parseSessionNotes, generateConsultationReport, generateSessionReport } from '@/lib/gemini'

const NEW_CLIENT_VALUE = '__new__'

const STAGE_LABEL = {
  preparation: '準備階段',
  stage1: '第一階段（模擬諮詢）',
  stage2: '第二階段（課程）',
  stage3: '第三階段（成果報告）',
  completed: '已完成',
}

const TIMESTAMP_FIELDS = ['date', 'next_session_date']

function getTodayStr() {
  const d = new Date()
  const m = String(d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric' }).replace('月', '')).padStart(2, '0')
  const day = String(d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', day: 'numeric' }).replace('日', '')).padStart(2, '0')
  return `${m}/${day}`
}

function sanitize(data) {
  if (!data || typeof data !== 'object') return data
  const cleaned = {}
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue
    if (typeof v === 'string' && v.trim() === '') continue
    if (typeof v === 'string' && /無法判斷|未知|不明|N\/A|none|null/i.test(v)) continue
    if (TIMESTAMP_FIELDS.includes(k)) {
      const parsed = new Date(v)
      if (isNaN(parsed.getTime())) continue
    }
    cleaned[k] = v
  }
  return cleaned
}

function reportToHtml(text) {
  const lines = text.split('\n')
  const htmlLines = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return '<br>'
    if (trimmed.startsWith('標題：') || (trimmed.includes('階段') && (trimmed.includes('🟢') || trimmed.includes('🔵')))) {
      return `<h2>${esc(trimmed.replace(/^標題：/, ''))}</h2>`
    }
    if (['上次任務回顧', '專案進度討論', '課程進度討論', '本次任務指派', '時程規劃', '預期成果'].some(h => trimmed.startsWith(h))) {
      return `<h3>${esc(trimmed)}</h3>`
    }
    if (trimmed.startsWith('【')) return `<p><strong>${esc(trimmed)}</strong></p>`
    if (trimmed.startsWith('->') || trimmed.startsWith('➤')) return `<p style="margin-left:1.5em">${esc(trimmed)}</p>`
    return `<p>${esc(trimmed)}</p>`
  })
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.7">${htmlLines.join('')}</body></html>`
}

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function DataRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-3 text-xs">
      <span className="font-mono text-muted-foreground uppercase tracking-wider flex-shrink-0 w-20">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  )
}

function ReportOutput({ report, generating }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const html = reportToHtml(report)
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([report], { type: 'text/plain' }),
        }),
      ])
    } catch {
      navigator.clipboard.writeText(report)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!generating && !report) return null

  return (
    <div className="border border-border mt-6">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <span className="font-mono text-xs tracking-widest uppercase text-muted-foreground">報告輸出</span>
        {report && (
          <button
            onClick={handleCopy}
            className="font-mono text-xs tracking-wider border border-primary/40 text-primary px-3 py-1.5 hover:bg-primary/10 transition-all duration-200"
          >
            {copied ? '已複製 ✓' : '複製'}
          </button>
        )}
      </div>
      <div className="p-5">
        {generating && !report
          ? <p className="text-sm text-muted-foreground font-mono text-center py-8">AI 生成中，請稍候...</p>
          : <pre className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">{report}</pre>
        }
      </div>
    </div>
  )
}

export default function AIAssistant() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('update')
  const [clients, setClients] = useState([])

  // ── 預寫報告 state ──
  const [reportClientId, setReportClientId] = useState('')
  const [reportData, setReportData] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [preReport, setPreReport] = useState('')
  const [preGenerating, setPreGenerating] = useState(false)

  // ── 更新進度 state ──
  const [selectedClientId, setSelectedClientId] = useState('')
  const [stageHint, setStageHint] = useState('') // 'profile' | 'consultation' | 'session'
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedClientId, setSavedClientId] = useState(null)
  const [postReport, setPostReport] = useState('')
  const [postGenerating, setPostGenerating] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saved

  useEffect(() => {
    supabase.from('clients').select('id, name, current_stage').order('name')
      .then(({ data }) => setClients(data || []))
  }, [])

  // Load client data for pre-report
  useEffect(() => {
    if (!reportClientId) { setReportData(null); setPreReport(''); return }
    setReportLoading(true)
    setPreReport('')
    Promise.all([
      supabase.from('clients').select('*').eq('id', reportClientId).single(),
      supabase.from('consultations').select('*').eq('client_id', reportClientId).maybeSingle(),
      supabase.from('tasks').select('*').eq('client_id', reportClientId).order('created_at'),
      supabase.from('sessions').select('*').eq('client_id', reportClientId).order('session_number', { ascending: false }),
    ]).then(([{ data: client }, { data: consultation }, { data: tasks }, { data: sessions }]) => {
      const sessionList = sessions ?? []
      setReportData({ client, consultation, tasks: tasks ?? [], sessionCount: sessionList.length, latestSession: sessionList[0] ?? null })
      setReportLoading(false)
    })
  }, [reportClientId])

  // ── 預寫報告 ──

  async function handlePreGenerate() {
    if (!reportData) return
    setPreGenerating(true)
    setPreReport('')
    try {
      const { client, consultation, tasks, sessionCount, latestSession } = reportData
      let text
      if (['preparation', 'stage1'].includes(client.current_stage)) {
        text = await generateConsultationReport({ client, consultation, tasks })
      } else {
        text = await generateSessionReport({ client, consultation, tasks, sessionNumber: sessionCount + 1, todayStr: getTodayStr(), latestSession })
      }
      setPreReport(text)
    } catch (err) {
      alert(`生成失敗：${err.message}`)
    } finally {
      setPreGenerating(false)
    }
  }

  // ── 更新進度 ──

  const isNew = selectedClientId === NEW_CLIENT_VALUE
  const selectedClient = isNew ? null : clients.find(c => c.id === selectedClientId)

  function resetUpdate() {
    setSaveStatus('idle')
    setSavedClientId(null)
    setPostReport('')
    setError('')
  }

  async function handleSubmit() {
    if (!selectedClientId || !notes.trim()) return
    resetUpdate()
    setLoading(true)
    try {
      const parsed = await parseSessionNotes({
        clientName: selectedClient?.name ?? '',
        currentStage: selectedClient?.current_stage ?? '',
        notes: notes.trim(),
        isNew,
        stageHint,
      })

      let clientId = selectedClientId
      let resolvedName = selectedClient?.name ?? ''

      for (const action of parsed.actions) {
        if (action.type === 'insert_client') {
          const clean = sanitize(action.data)
          const { data, error: e } = await supabase.from('clients').insert(clean).select().single()
          if (e) throw new Error(`新增個案失敗：${e.message}`)
          clientId = data.id
          resolvedName = data.name
          setClients(prev => [...prev, { id: data.id, name: data.name, current_stage: data.current_stage }])
        }
        if (action.type === 'update_client') {
          const clean = sanitize(action.data)
          const { error: e } = await supabase.from('clients').update(clean).eq('id', clientId)
          if (e) throw new Error(`更新個案失敗：${e.message}`)
        }
        if (action.type === 'insert_consultation') {
          const clean = sanitize(action.data)
          const { error: e } = await supabase.from('consultations').insert({ ...clean, client_id: clientId })
          if (e) throw new Error(`新增諮詢紀錄失敗：${e.message}`)
        }
        if (action.type === 'insert_session') {
          const clean = sanitize(action.data)
          const { error: e } = await supabase.from('sessions').insert({ ...clean, client_id: clientId })
          if (e) throw new Error(`新增課程紀錄失敗：${e.message}`)
        }
        if (action.type === 'insert_tasks') {
          const dataArr = Array.isArray(action.data) ? action.data : [action.data]
          const tasks = dataArr.map(t => ({ ...sanitize(t), client_id: clientId }))
          const { error: e } = await supabase.from('tasks').insert(tasks)
          if (e) throw new Error(`新增作業失敗：${e.message}`)
        }
      }

      setSavedClientId(clientId)
      setSaveStatus('saved')

      // Auto-generate report from updated DB data
      const hasConsultation = parsed.actions.some(a => a.type === 'insert_consultation')
      const hasSession = parsed.actions.some(a => a.type === 'insert_session')
      if (hasConsultation || hasSession) {
        setPostGenerating(true)
        try {
          const [{ data: client }, { data: consultation }, { data: tasks }, { data: sessions }] = await Promise.all([
            supabase.from('clients').select('*').eq('id', clientId).single(),
            supabase.from('consultations').select('*').eq('client_id', clientId).maybeSingle(),
            supabase.from('tasks').select('*').eq('client_id', clientId).order('created_at'),
            supabase.from('sessions').select('id').eq('client_id', clientId),
          ])
          let text
          if (hasConsultation) {
            text = await generateConsultationReport({ client, consultation, tasks: tasks ?? [] })
          } else {
            text = await generateSessionReport({
              client, consultation, tasks: tasks ?? [],
              sessionNumber: (sessions ?? []).length,
              todayStr: getTodayStr(),
            })
          }
          setPostReport(text)
        } catch (err) {
          // report generation failure is non-critical
          console.error('報告生成失敗：', err.message)
        } finally {
          setPostGenerating(false)
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── UI ──

  const { client, consultation, tasks } = reportData ?? {}
  const doneTasks = tasks?.filter(t => t.completed) ?? []
  const pendingTasks = tasks?.filter(t => !t.completed) ?? []
  const reportTypeLabel = reportData?.client
    ? (['preparation', 'stage1'].includes(reportData.client.current_stage) ? '諮詢報告' : '課程報告')
    : '報告'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="max-w-3xl mx-auto px-8 py-10">

        <h1 className="font-display text-xl font-medium tracking-tight mb-8">AI 助理</h1>

        {/* Tabs */}
        <div className="flex border-b border-border mb-8">
          {[['update', '更新進度'], ['report', '預寫報告']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`text-xs font-mono tracking-widest uppercase px-5 py-2.5 border-b-2 transition-all duration-200 ${
                mode === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 更新進度 ── */}
        {mode === 'update' && (
          <div>
            {/* 選個案 */}
            <div className="mb-6">
              <label className="text-xs font-mono tracking-widest uppercase text-muted-foreground block mb-2">選擇個案</label>
              <select
                value={selectedClientId}
                onChange={e => { setSelectedClientId(e.target.value); setStageHint(''); setNotes(''); resetUpdate() }}
                className="w-full bg-card border border-border text-foreground text-sm px-3 py-2 focus:outline-none focus:border-primary/60"
              >
                <option value="">— 請選擇 —</option>
                <option value={NEW_CLIENT_VALUE}>＋ 新增學生</option>
                <optgroup label="現有個案">
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}（{STAGE_LABEL[c.current_stage] || c.current_stage}）
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* 階段選擇（新學生只顯示學生狀況） */}
            {selectedClientId && (
              <div className="mb-6">
                <label className="text-xs font-mono tracking-widest uppercase text-muted-foreground block mb-3">記錄階段</label>
                <div className="flex items-center gap-0">
                  {(isNew
                    ? [{ key: 'profile', label: '學生狀況', desc: '建立學生基本資料' }]
                    : [
                        { key: 'profile',       label: '學生狀況',  desc: '更新背景資料' },
                        { key: 'consultation',  label: '第一階段後', desc: '模擬諮詢結束' },
                        { key: 'session',       label: '第二階段後', desc: '課程結束' },
                      ]
                  ).map(({ key, label, desc }, i, arr) => (
                    <div key={key} className="flex items-center">
                      <button
                        onClick={() => { setStageHint(key); setNotes(''); resetUpdate() }}
                        className={`flex flex-col items-center px-5 py-3 border transition-all duration-200 ${
                          stageHint === key
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                        }`}
                      >
                        <span className="text-xs font-mono tracking-wider">{label}</span>
                        <span className="text-[10px] font-mono text-muted-foreground mt-0.5">{desc}</span>
                      </button>
                      {i < arr.length - 1 && (
                        <span className="text-border text-xs font-mono px-1">→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 紀錄輸入 */}
            {selectedClientId && stageHint && (
              <>
                <div className="mb-6">
                  <label className="text-xs font-mono tracking-widest uppercase text-muted-foreground block mb-2">
                    {stageHint === 'profile' && (isNew ? '學生基本資料' : '更新內容')}
                    {stageHint === 'consultation' && '諮詢紀錄'}
                    {stageHint === 'session' && '課程紀錄'}
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => { setNotes(e.target.value); resetUpdate() }}
                    placeholder={
                      stageHint === 'profile'
                        ? (isNew ? '學生姓名、職業、背景、想學什麼...' : '要更新的資料，例如：下次上課改到週三 20:00')
                        : stageHint === 'consultation'
                        ? '諮詢內容、學生背景評估、提案方向、作業指派...'
                        : '這堂課的目標、進度、下次作業...'
                    }
                    rows={10}
                    className="w-full bg-card border border-border text-foreground text-sm px-3 py-2 focus:outline-none focus:border-primary/60 resize-none font-mono placeholder:text-muted-foreground/40"
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading || !notes.trim()}
                  className="text-xs font-mono tracking-wider border border-primary/40 text-primary px-6 py-2 hover:bg-primary/10 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {loading ? '處理中...' : '⚡ 解析並儲存'}
                </button>
              </>
            )}

            {error && (
              <div className="mt-6 border border-destructive/40 bg-destructive/10 text-destructive text-xs font-mono px-4 py-3">
                {error}
              </div>
            )}

            {saveStatus === 'saved' && (
              <div className="mt-6">
                <div className="flex items-center gap-4 border border-primary/30 bg-primary/5 px-5 py-3">
                  <p className="text-xs text-primary font-mono flex-1">✓ 儲存完成</p>
                  <button
                    onClick={() => navigate(`/clients/${savedClientId}`)}
                    className="text-xs font-mono tracking-wider border border-primary/40 text-primary px-4 py-1.5 hover:bg-primary/10 transition-all duration-200 flex-shrink-0"
                  >
                    查看個案 →
                  </button>
                </div>
                <ReportOutput report={postReport} generating={postGenerating} />
              </div>
            )}
          </div>
        )}

        {/* ── 預寫報告 ── */}
        {mode === 'report' && (
          <div>
            <div className="mb-6">
              <label className="text-xs font-mono tracking-widest uppercase text-muted-foreground block mb-2">選擇個案</label>
              <select
                value={reportClientId}
                onChange={e => { setReportClientId(e.target.value); setPreReport('') }}
                className="w-full bg-card border border-border text-foreground text-sm px-3 py-2 focus:outline-none focus:border-primary/60"
              >
                <option value="">— 請選擇 —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}（{STAGE_LABEL[c.current_stage] || c.current_stage}）
                  </option>
                ))}
              </select>
            </div>

            {reportLoading && <p className="text-xs font-mono text-muted-foreground">載入中...</p>}

            {reportData && !reportLoading && (
              <>
                <div className="mb-6 border border-border p-4 space-y-2.5">
                  <p className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-3">現有資料</p>
                  <DataRow label="專案" value={client?.project_name} />
                  <DataRow label="目標" value={client?.goals?.join('、')} />
                  <DataRow label="技術背景" value={client?.skills} />
                  {consultation ? (
                    <>
                      <DataRow label="諮詢日期" value={consultation.date ? new Date(consultation.date).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }) : null} />
                      <DataRow label="摘要" value={consultation.summary} />
                      <DataRow label="工具" value={consultation.tools} />
                      <DataRow label="每週時間" value={consultation.weekly_hours} />
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground font-mono">尚無諮詢紀錄</p>
                  )}
                  {tasks.length > 0 && (
                    <div>
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">作業</p>
                      <div className="space-y-0.5">
                        {doneTasks.map(t => <p key={t.id} className="text-xs text-foreground font-mono">✓ {t.description}</p>)}
                        {pendingTasks.map(t => <p key={t.id} className="text-xs text-muted-foreground font-mono">○ {t.description}</p>)}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePreGenerate}
                  disabled={preGenerating}
                  className="text-xs font-mono tracking-wider border border-primary/40 bg-primary/10 text-primary px-6 py-2.5 hover:bg-primary/20 transition-all duration-200 disabled:opacity-50"
                >
                  {preGenerating ? '生成中...' : `✦ 生成${reportTypeLabel}`}
                </button>

                <ReportOutput report={preReport} generating={preGenerating} />
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
