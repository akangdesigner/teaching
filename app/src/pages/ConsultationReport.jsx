import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import { generateConsultationReport } from '../lib/gemini'

export default function ConsultationReport() {
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
      .eq('current_stage', 'stage1')
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
    ]).then(([{ data: client }, { data: consultation }, { data: tasks }]) => {
      setData({ client, consultation, tasks: tasks ?? [] })
      setLoading(false)
    })
  }, [selectedId])

  async function handleGenerate() {
    if (!data) return
    setGenerating(true)
    setReport('')
    try {
      const text = await generateConsultationReport(data)
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

  const { client, consultation, tasks } = data ?? {}

  return (
    <div>
      <Navbar />
      <main className="max-w-4xl mx-auto px-8 py-10">

        <h1 className="font-display text-3xl font-medium text-foreground mb-2 tracking-tight">諮詢報告生成</h1>
        <p className="text-sm text-muted-foreground font-mono mb-8">第一階段｜根據現有資料自動產出報告格式</p>

        {/* 選擇個案 */}
        <div className="mb-8">
          <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground mb-2">選擇個案</p>
          <div className="flex flex-wrap gap-2">
            {clients.length === 0 && (
              <p className="text-sm text-muted-foreground font-mono">目前沒有第一階段個案</p>
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

        {/* 現有資料預覽 */}
        {data && !loading && (
          <div className="mb-8 border border-border p-5 space-y-3">
            <p className="font-mono text-xs tracking-widest uppercase text-muted-foreground mb-3">現有資料</p>

            <Row label="專案" value={client?.project_name} />
            <Row label="目標" value={client?.goals?.join('、')} />
            <Row label="技術背景" value={client?.skills} />
            {consultation ? (
              <>
                <Row label="諮詢日期" value={consultation.date ? new Date(consultation.date).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }) : null} />
                <Row label="摘要" value={consultation.summary} />
                <Row label="工具" value={consultation.tools} />
                <Row label="每週時間" value={consultation.weekly_hours} />
                <Row label="提案方向" value={consultation.project_proposals?.join('、')} />
                <Row label="備註" value={consultation.notes} />
              </>
            ) : (
              <p className="text-xs text-muted-foreground font-mono">尚無諮詢紀錄</p>
            )}
            {tasks.length > 0 && (
              <div>
                <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">作業</span>
                <div className="mt-1 space-y-0.5">
                  {tasks.map(t => (
                    <p key={t.id} className="text-xs text-foreground font-mono">
                      {t.completed ? '✓' : '○'} {t.description}
                    </p>
                  ))}
                </div>
              </div>
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
              {generating ? '生成中...' : '✦ 生成諮詢報告'}
            </button>
          </div>
        )}

        {/* 報告輸出 */}
        {(generating || report) && (
          <div className="border border-border">
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
        )}

      </main>
    </div>
  )
}

const SECTION_HEADERS = ['上次任務回顧', '專案進度討論', '本次任務指派', '時程規劃', '預期成果']

function reportToHtml(text) {
  const lines = text.split('\n')
  const htmlLines = lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return '<br>'

    // 大標題（含「標題：」或第一行 🟢）
    if (trimmed.startsWith('標題：') || (trimmed.includes('第一階段諮詢紀錄') && trimmed.includes('🟢'))) {
      const content = trimmed.replace(/^標題：/, '')
      return `<h2>${escape(content)}</h2>`
    }

    // 段落標題
    if (SECTION_HEADERS.some(h => trimmed.startsWith(h))) {
      return `<h3>${escape(trimmed)}</h3>`
    }

    // 粗體（【...】開頭的行）
    if (trimmed.startsWith('【')) {
      return `<p><strong>${escape(trimmed)}</strong></p>`
    }

    // 任務進度（-> 或 ➤ 開頭）
    if (trimmed.startsWith('->') || trimmed.startsWith('➤')) {
      return `<p style="margin-left:1.5em">${escape(trimmed)}</p>`
    }

    return `<p>${escape(trimmed)}</p>`
  })

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.7">${htmlLines.join('')}</body></html>`
}

function escape(str) {
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
