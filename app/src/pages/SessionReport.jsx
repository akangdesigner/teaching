import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import { generateSessionReport } from '../lib/gemini'
import { generateWordReport, downloadWordBlob } from '../lib/wordGenerator'

function getTodayStr() {
  const d = new Date()
  const m = String(d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric' }).replace('月', '')).padStart(2, '0')
  const day = String(d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', day: 'numeric' }).replace('日', '')).padStart(2, '0')
  return `${m}/${day}`
}

export default function SessionReport() {
  const [clients, setClients] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name, project_name, current_stage')
      .eq('current_stage', 'active')
      .order('name')
      .then(({ data }) => setClients(data ?? []))
  }, [])

  useEffect(() => {
    if (!selectedId) { setData(null); setReport(''); return }
    setLoading(true)
    setReport('')
    Promise.all([
      supabase.from('clients').select('*').eq('id', selectedId).single(),
      supabase.from('consultations').select('*').eq('client_id', selectedId).maybeSingle(),
      supabase.from('tasks').select('*').eq('client_id', selectedId).order('created_at'),
      supabase.from('sessions').select('*').eq('client_id', selectedId).order('session_number', { ascending: false }),
    ]).then(([{ data: client }, { data: consultation }, { data: tasks }, { data: sessions }]) => {
      const sessionList = sessions ?? []
      setData({ client, consultation, tasks: tasks ?? [], sessionCount: sessionList.length, latestSession: sessionList[0] ?? null })
      setLoading(false)
    })
  }, [selectedId])

  async function handleGenerate() {
    if (!data) return
    setGenerating(true)
    setReport('')
    try {
      const text = await generateSessionReport({
        client: data.client,
        consultation: data.consultation,
        tasks: data.tasks,
        sessionNumber: data.sessionCount + 1,
        todayStr: getTodayStr(),
        latestSession: data.latestSession,
      })
      setReport(text)
    } catch (err) {
      alert(`生成失敗：${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

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

  async function handleDownloadWord() {
    const firstLine = report.split('\n').find(l => l.trim()) ?? '課程報告'
    const title = firstLine.replace(/^標題：/, '').replace(/[🟢🔵]/g, '').trim()
    const blob = await generateWordReport(title, report)
    const date = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }).replace(/\//g, '-')
    downloadWordBlob(blob, `${title}_${date}.docx`)
  }

  const { client, consultation, tasks } = data ?? {}
  const doneTasks = tasks?.filter(t => t.completed) ?? []
  const pendingTasks = tasks?.filter(t => !t.completed) ?? []

  return (
    <div>
      <Navbar />
      <main className="max-w-4xl mx-auto px-8 py-10">

        <h1 className="font-display text-3xl font-medium text-foreground mb-2 tracking-tight">課程報告生成</h1>
        <p className="text-sm text-muted-foreground font-mono mb-8">
          根據先前作業，產出今日課前報告
        </p>

        {/* 選擇學生 */}
        <div className="mb-8">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground mb-2">選擇學生</p>
          <div className="flex flex-wrap gap-2">
            {clients.length === 0 && (
              <p className="text-sm text-muted-foreground font-mono">目前沒有進行中的學生</p>
            )}
            {clients.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`font-mono text-xs px-4 py-2 border transition-all duration-200 ${
                  selectedId === c.id
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="text-sm text-muted-foreground font-mono">載入中...</p>}

        {/* 資料預覽 */}
        {data && !loading && (
          <div className="mb-8 border border-border p-5 space-y-4">
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">現有資料</p>

            <Row label="主題" value={client?.project_name} />
            <Row label="目標" value={client?.goals?.join('、')} />
            <Row label="教材" value={consultation?.tools} />
            <Row label="摘要" value={consultation?.summary} />
            {data.sessionCount > 0 && (
              <Row label="堂次" value={`已上 ${data.sessionCount} 堂，本次第 ${data.sessionCount + 1} 堂`} />
            )}

            {tasks.length > 0 ? (
              <div>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">上次作業</p>
                <div className="space-y-0.5">
                  {doneTasks.map(t => (
                    <p key={t.id} className="text-xs text-foreground font-mono">✓ {t.description}</p>
                  ))}
                  {pendingTasks.map(t => (
                    <p key={t.id} className="text-xs text-muted-foreground font-mono">○ {t.description}</p>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground font-mono">尚無作業紀錄</p>
            )}
          </div>
        )}

        {/* 生成按鈕 */}
        {data && !loading && (
          <div className="mb-6">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="font-mono text-xs tracking-wider border border-primary/40 bg-primary/10 text-primary px-6 py-2.5 hover:bg-primary/20 transition-all duration-200 disabled:opacity-50"
            >
              {generating ? '生成中...' : '✦ 生成今日課程報告'}
            </button>
          </div>
        )}

        {/* 報告輸出 */}
        {(generating || report) && (
          <div className="border border-border">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <span className="font-mono text-xs tracking-widest uppercase text-muted-foreground">報告輸出</span>
              {report && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadWord}
                    className="font-mono text-xs tracking-wider border border-border text-muted-foreground px-3 py-1.5 hover:border-foreground hover:text-foreground transition-all duration-200"
                  >
                    ⬇ Word
                  </button>
                  <button
                    onClick={handleCopy}
                    className="font-mono text-xs tracking-wider border border-primary/40 text-primary px-3 py-1.5 hover:bg-primary/10 transition-all duration-200"
                  >
                    {copied ? '已複製 ✓' : '複製'}
                  </button>
                </div>
              )}
            </div>
            <div className="p-5">
              {generating && !report
                ? <p className="text-sm text-muted-foreground font-mono text-center py-8">AI 生成中，請稍候...</p>
                : <pre className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">{report}</pre>
              }
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

function reportToHtml(text) {
  const lines = text.split('\n')
  const htmlLines = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return '<br>'
    if (trimmed.startsWith('標題：') || trimmed.includes('🟢') || trimmed.includes('🔵')) {
      return `<h2>${esc(trimmed.replace(/^標題：/, ''))}</h2>`
    }
    if (['上次任務回顧', '課程進度討論', '本次任務指派'].some(h => trimmed.startsWith(h))) {
      return `<h3>${esc(trimmed)}</h3>`
    }
    if (trimmed.startsWith('【')) return `<p><strong>${esc(trimmed)}</strong></p>`
    if (trimmed.startsWith('->') || trimmed.startsWith('➤')) {
      return `<p style="margin-left:1.5em">${esc(trimmed)}</p>`
    }
    return `<p>${esc(trimmed)}</p>`
  })
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.7">${htmlLines.join('')}</body></html>`
}

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function Row({ label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-3 text-xs">
      <span className="font-mono text-muted-foreground uppercase tracking-wider flex-shrink-0 w-20">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  )
}
