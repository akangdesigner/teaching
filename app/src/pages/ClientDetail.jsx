import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDate, toDatetimeInput } from '../lib/format'
import Navbar from '../components/Navbar'
import StageTag from '../components/StageTag'
import { Separator } from '@/components/ui/separator'
import { generateAndDownloadPPT } from '../lib/pptGenerator'
import { generateConsultationReport } from '../lib/gemini'

function SectionTitle({ children }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="font-mono text-xs tracking-widest uppercase text-muted-foreground">{children}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function Field({ label, value }) {
  if (!value) return null
  return (
    <div className="mb-4">
      <p className="font-mono text-xs tracking-wider uppercase text-muted-foreground mb-1">{label}</p>
      <p className="text-sm text-foreground leading-relaxed">{value}</p>
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [consultation, setConsultation] = useState(null)
  const [sessions, setSessions] = useState([])
  const [tasks, setTasks] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reportModal, setReportModal] = useState(null)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState(null)
  const [editSessionForm, setEditSessionForm] = useState({})
  const [editingNextSession, setEditingNextSession] = useState(false)
  const [nextSessionInput, setNextSessionInput] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('consultations').select('*').eq('client_id', id).maybeSingle(),
      supabase.from('sessions').select('*').eq('client_id', id).order('session_number'),
      supabase.from('tasks').select('*').eq('client_id', id).order('created_at'),
      supabase.from('reports').select('*').eq('client_id', id).maybeSingle(),
    ]).then(([c, con, ses, t, r]) => {
      setClient(c.data)
      setConsultation(con.data)
      setSessions(ses.data ?? [])
      setTasks(t.data ?? [])
      setReport(r.data)
      setLoading(false)
    })
  }, [id])

  async function toggleTask(task) {
    const { data } = await supabase
      .from('tasks').update({ completed: !task.completed })
      .eq('id', task.id).select().single()
    setTasks(prev => prev.map(t => t.id === task.id ? data : t))
  }

  async function handleGeneratePPT() {
    setGenerating(true)
    try {
      await generateAndDownloadPPT({ client, sessions, tasks, consultation })
    } catch (err) {
      alert(`生成失敗：${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  async function handleGenerateReport() {
    setGeneratingReport(true)
    setReportModal('')
    try {
      const text = await generateConsultationReport({ client, consultation, tasks })
      setReportModal(text)
    } catch (err) {
      alert(`生成失敗：${err.message}`)
      setReportModal(null)
    } finally {
      setGeneratingReport(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(reportModal)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function deleteTask(taskId) {
    await supabase.from('tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  async function deleteSession(sessionId) {
    if (!window.confirm('確定刪除這筆課程紀錄？')) return
    await supabase.from('sessions').delete().eq('id', sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
  }

  function startEditSession(session) {
    setEditingSessionId(session.id)
    setEditSessionForm({
      session_number: session.session_number ?? '',
      date: session.date ? toDatetimeInput(session.date) : '',
      objectives: session.objectives ?? '',
      progress: session.progress ?? '',
      notes: session.notes ?? '',
    })
  }

  async function saveSession() {
    const payload = {
      session_number: Number(editSessionForm.session_number) || null,
      date: editSessionForm.date || null,
      objectives: editSessionForm.objectives.trim() || null,
      progress: editSessionForm.progress.trim() || null,
      notes: editSessionForm.notes.trim() || null,
    }
    const { data } = await supabase.from('sessions').update(payload).eq('id', editingSessionId).select().single()
    setSessions(prev => prev.map(s => s.id === editingSessionId ? data : s))
    setEditingSessionId(null)
  }

  async function saveNextSession() {
    const { data } = await supabase
      .from('clients').update({ next_session_date: nextSessionInput ? new Date(nextSessionInput).toISOString() : null })
      .eq('id', id).select().single()
    setClient(data)
    setEditingNextSession(false)
  }

  async function deleteClient() {
    if (!window.confirm(`確定要刪除「${client.name}」的所有資料嗎？`)) return
    await supabase.from('tasks').delete().eq('client_id', id)
    await supabase.from('consultations').delete().eq('client_id', id)
    await supabase.from('sessions').delete().eq('client_id', id)
    await supabase.from('reports').delete().eq('client_id', id)
    await supabase.from('clients').delete().eq('id', id)
    navigate('/')
  }

  if (loading) return (
    <div>
      <Navbar />
      <p className="text-center py-20 text-muted-foreground font-mono text-sm">載入中...</p>
    </div>
  )
  if (!client) return (
    <div>
      <Navbar />
      <p className="text-center py-20 text-destructive font-mono text-sm">找不到個案</p>
    </div>
  )

  const pendingTasks = tasks.filter(t => !t.completed)
  const doneTasks = tasks.filter(t => t.completed)

  return (
    <div>
      <Navbar />

      {/* 諮詢報告 Modal */}
      {reportModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <span className="font-mono text-xs tracking-widest uppercase text-muted-foreground">第一階段諮詢報告</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!reportModal}
                  className="font-mono text-xs tracking-wider border border-primary/40 text-primary px-3 py-1.5 hover:bg-primary/10 transition-all duration-200 disabled:opacity-40"
                >
                  {copied ? '已複製 ✓' : '複製'}
                </button>
                <button
                  onClick={() => setReportModal(null)}
                  className="font-mono text-xs tracking-wider border border-border text-muted-foreground px-3 py-1.5 hover:border-foreground hover:text-foreground transition-all duration-200"
                >
                  關閉
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {!reportModal
                ? <p className="text-sm text-muted-foreground font-mono text-center py-10">生成中，請稍候...</p>
                : <pre className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">{reportModal}</pre>
              }
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-4xl font-medium text-foreground tracking-tight leading-tight mb-2">
              {client.name}
            </h1>
            <p className="text-muted-foreground text-sm mb-2">{client.project_name}</p>
            <StageTag stage={client.current_stage} />
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={handleGeneratePPT}
              disabled={generating}
              className="font-mono text-xs tracking-wider border border-primary/40 text-primary px-4 py-2 hover:bg-primary/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? '生成中...' : '⬇ 生成教材'}
            </button>
            <Link
              to={`/clients/${id}/edit`}
              className="font-mono text-xs tracking-wider border border-border text-muted-foreground px-4 py-2 hover:border-foreground hover:text-foreground transition-all duration-200"
            >
              編輯
            </Link>
            <button
              onClick={deleteClient}
              className="font-mono text-xs tracking-wider border border-destructive/30 text-destructive px-4 py-2 hover:bg-destructive/10 transition-all duration-200"
            >
              刪除
            </button>
          </div>
        </div>

        {/* Next session */}
        <div className="mb-8 flex items-center gap-4 border border-primary/20 bg-primary/5 px-5 py-3">
          <div className="w-1 h-8 bg-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="font-mono text-xs tracking-widest uppercase text-primary/70 mb-0.5">下次上課</p>
            {editingNextSession ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="datetime-local"
                  value={nextSessionInput}
                  onChange={e => setNextSessionInput(e.target.value)}
                  className="bg-transparent border border-primary/40 text-primary text-xs font-mono px-2 py-1 focus:outline-none focus:border-primary"
                  autoFocus
                />
                <button
                  onClick={saveNextSession}
                  className="font-mono text-xs border border-primary/40 text-primary px-3 py-1 hover:bg-primary/10 transition-all duration-150"
                >
                  儲存
                </button>
                <button
                  onClick={() => setEditingNextSession(false)}
                  className="font-mono text-xs border border-border text-muted-foreground px-3 py-1 hover:border-foreground transition-all duration-150"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="font-mono text-sm text-primary font-medium">
                  {client.next_session_date ? formatDate(client.next_session_date) : '尚未設定'}
                </p>
                <button
                  onClick={() => {
                    setNextSessionInput(toDatetimeInput(client.next_session_date))
                    setEditingNextSession(true)
                  }}
                  className="font-mono text-xs text-primary/50 hover:text-primary transition-colors duration-150"
                >
                  調整
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-10">

          {/* 個案背景 */}
          <section>
            <SectionTitle>個案背景</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
              <Field label="目前狀況" value={client.situation} />
              <Field label="性格特質" value={client.personality} />
              <Field label="技術背景" value={client.skills} />
            </div>
            {client.goals?.length > 0 && (
              <div>
                <p className="font-mono text-xs tracking-wider uppercase text-muted-foreground mb-2">學習目標</p>
                <ul className="space-y-1.5">
                  {client.goals.map((g, i) => (
                    <li key={i} className="text-sm flex gap-3">
                      <span className="font-mono text-primary text-xs mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, '0')}.</span>
                      <span className="text-foreground">{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* 作業清單 */}
          <section>
            <SectionTitle>作業清單</SectionTitle>
            {tasks.length === 0 && (
              <p className="text-sm text-muted-foreground font-mono">尚無作業</p>
            )}
            <div className="space-y-2">
              {pendingTasks.map(task => (
                <div key={task.id} className="flex items-start gap-3 group">
                  <div
                    onClick={() => toggleTask(task)}
                    className="w-4 h-4 mt-0.5 flex-shrink-0 border border-border group-hover:border-primary transition-colors duration-150 flex items-center justify-center cursor-pointer"
                  />
                  <span className="text-sm group-hover:text-primary transition-colors duration-150 leading-relaxed flex-1">
                    {task.description}
                  </span>
                  <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-xs text-destructive/60 hover:text-destructive transition-all duration-150 flex-shrink-0">✕</button>
                </div>
              ))}
              {doneTasks.length > 0 && (
                <>
                  <div className="h-px bg-border my-3" />
                  <p className="font-mono text-xs tracking-wider uppercase text-muted-foreground mb-2">已完成</p>
                  {doneTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-3 group">
                      <div
                        onClick={() => toggleTask(task)}
                        className="w-4 h-4 mt-0.5 flex-shrink-0 border border-primary/40 bg-primary/10 flex items-center justify-center cursor-pointer"
                      >
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
                        </svg>
                      </div>
                      <span className="text-sm text-muted-foreground line-through leading-relaxed flex-1">
                        {task.description}
                      </span>
                      <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-xs text-destructive/60 hover:text-destructive transition-all duration-150 flex-shrink-0">✕</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          {/* 第一階段 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 flex-1">
                <span className="font-mono text-xs tracking-widest uppercase text-muted-foreground">第一階段｜模擬諮詢</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {consultation && (
                <button
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  className="ml-4 flex-shrink-0 font-mono text-xs tracking-wider border border-border text-muted-foreground px-3 py-1.5 hover:border-foreground hover:text-foreground transition-all duration-200 disabled:opacity-50"
                >
                  {generatingReport ? '生成中...' : '✦ 生成諮詢報告'}
                </button>
              )}
            </div>
            {!consultation
              ? <p className="text-sm text-muted-foreground font-mono">尚未記錄</p>
              : (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                    <Field label="日期" value={formatDate(consultation.date)} />
                    <Field label="技術程度" value={{ beginner: '初學', intermediate: '有基礎', advanced: '進階' }[consultation.tech_level]} />
                    <Field label="每週可投入時間" value={consultation.weekly_hours} />
                    <Field label="主軸工具" value={consultation.tools} />
                  </div>
                  <Field label="諮詢摘要" value={consultation.summary} />
                  {consultation.project_proposals?.length > 0 && (
                    <div className="mb-4">
                      <p className="font-mono text-xs tracking-wider uppercase text-muted-foreground mb-2">專案提案</p>
                      <ul className="space-y-1">
                        {consultation.project_proposals.map((p, i) => (
                          <li key={i} className="text-sm flex gap-3">
                            <span className="font-mono text-xs text-muted-foreground mt-0.5 flex-shrink-0">{i + 1}.</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Field label="備註" value={consultation.notes} />
                </div>
              )
            }
          </section>

          {/* 第二階段 */}
          <section>
            <SectionTitle>第二階段｜課程紀錄</SectionTitle>
            {sessions.length === 0
              ? <p className="text-sm text-muted-foreground font-mono">尚未開始課程</p>
              : (
                <div className="space-y-6">
                  {sessions.map((s, i) => (
                    <div key={s.id} className="flex gap-5">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-6 h-6 rounded-sm border border-primary/40 bg-primary/10 text-primary font-mono text-xs flex items-center justify-center font-medium">
                          {s.session_number}
                        </div>
                        {i < sessions.length - 1 && <div className="w-px flex-1 bg-border mt-2" />}
                      </div>
                      <div className="pb-6 flex-1">
                        {editingSessionId === s.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="font-mono text-xs text-muted-foreground mb-1">堂次</p>
                                <input
                                  type="number"
                                  value={editSessionForm.session_number}
                                  onChange={e => setEditSessionForm(f => ({ ...f, session_number: e.target.value }))}
                                  className="w-full bg-card border border-border text-foreground text-xs px-2 py-1.5 focus:outline-none focus:border-primary/60 font-mono"
                                />
                              </div>
                              <div>
                                <p className="font-mono text-xs text-muted-foreground mb-1">日期</p>
                                <input
                                  type="datetime-local"
                                  value={editSessionForm.date}
                                  onChange={e => setEditSessionForm(f => ({ ...f, date: e.target.value }))}
                                  className="w-full bg-card border border-border text-foreground text-xs px-2 py-1.5 focus:outline-none focus:border-primary/60 font-mono"
                                />
                              </div>
                            </div>
                            {['objectives', 'progress', 'notes'].map(field => (
                              <div key={field}>
                                <p className="font-mono text-xs text-muted-foreground mb-1">
                                  {{ objectives: '本次目標', progress: '本次進度', notes: '備註' }[field]}
                                </p>
                                <textarea
                                  rows={3}
                                  value={editSessionForm[field]}
                                  onChange={e => setEditSessionForm(f => ({ ...f, [field]: e.target.value }))}
                                  className="w-full bg-card border border-border text-foreground text-xs px-2 py-1.5 focus:outline-none focus:border-primary/60 resize-none font-mono"
                                />
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <button onClick={saveSession} className="text-xs font-mono border border-primary/40 text-primary px-4 py-1.5 hover:bg-primary/10 transition-all duration-200">儲存</button>
                              <button onClick={() => setEditingSessionId(null)} className="text-xs font-mono border border-border text-muted-foreground px-4 py-1.5 hover:border-foreground transition-all duration-200">取消</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-mono text-xs text-muted-foreground">{formatDate(s.date)}</p>
                              <div className="flex gap-2">
                                <button onClick={() => startEditSession(s)} className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors duration-150">編輯</button>
                                <button onClick={() => deleteSession(s.id)} className="text-xs font-mono text-destructive/60 hover:text-destructive transition-colors duration-150">刪除</button>
                              </div>
                            </div>
                            <Field label="本次目標" value={s.objectives} />
                            <Field label="本次進度" value={s.progress} />
                            <Field label="備註" value={s.notes} />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </section>

          {/* 第三階段 */}
          <section>
            <SectionTitle>第三階段｜成果報告</SectionTitle>
            {!report
              ? <p className="text-sm text-muted-foreground font-mono">尚未完成</p>
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                  <Field label="日期" value={formatDate(report.date)} />
                  <Field label="技術掌握程度" value={report.tech_mastery} />
                  <Field label="自主學習能力" value={report.self_learning} />
                  <Field label="亮點" value={report.highlights} />
                  <Field label="待改進" value={report.improvements} />
                  <Field label="專案概述" value={report.project_overview} />
                  <Field label="達成成果" value={report.achievements} />
                  <Field label="第二次諮詢建議" value={report.recommendations} />
                  <Field label="整體總結" value={report.summary} />
                </div>
              )
            }
          </section>

        </div>
      </main>
    </div>
  )
}
