import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Navbar from '@/components/Navbar'

const PREFIX = 'tms_'
const TABLES = ['clients', 'consultations', 'sessions', 'tasks', 'reports']

function loadLocalData() {
  const result = {}
  for (const table of TABLES) {
    try {
      result[table] = JSON.parse(localStorage.getItem(PREFIX + table) ?? '[]')
    } catch {
      result[table] = []
    }
  }
  return result
}

export default function MigrationPage() {
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState('idle') // idle | confirming | importing | done | error
  const [log, setLog] = useState([])
  const [error, setError] = useState('')

  function handlePreview() {
    const data = loadLocalData()
    setPreview(data)
    setStatus('confirming')
  }

  function addLog(msg) {
    setLog(prev => [...prev, msg])
  }

  async function handleImport() {
    setStatus('importing')
    setLog([])
    setError('')

    try {
      const data = loadLocalData()

      // clients
      if (data.clients.length > 0) {
        addLog(`匯入 clients（${data.clients.length} 筆）...`)
        const rows = data.clients.map(({ id, ...rest }) => ({ ...rest }))
        // Keep original IDs for FK consistency
        const { error } = await supabase.from('clients').insert(data.clients)
        if (error) throw new Error('clients: ' + error.message)
        addLog('✓ clients 完成')
      }

      // consultations
      if (data.consultations.length > 0) {
        addLog(`匯入 consultations（${data.consultations.length} 筆）...`)
        const { error } = await supabase.from('consultations').insert(data.consultations)
        if (error) throw new Error('consultations: ' + error.message)
        addLog('✓ consultations 完成')
      }

      // sessions
      if (data.sessions.length > 0) {
        addLog(`匯入 sessions（${data.sessions.length} 筆）...`)
        const { error } = await supabase.from('sessions').insert(data.sessions)
        if (error) throw new Error('sessions: ' + error.message)
        addLog('✓ sessions 完成')
      }

      // tasks
      if (data.tasks.length > 0) {
        addLog(`匯入 tasks（${data.tasks.length} 筆）...`)
        const { error } = await supabase.from('tasks').insert(data.tasks)
        if (error) throw new Error('tasks: ' + error.message)
        addLog('✓ tasks 完成')
      }

      // reports
      if (data.reports.length > 0) {
        addLog(`匯入 reports（${data.reports.length} 筆）...`)
        const { error } = await supabase.from('reports').insert(data.reports)
        if (error) throw new Error('reports: ' + error.message)
        addLog('✓ reports 完成')
      }

      addLog('✓ 所有資料匯入完成！')
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  const totalItems = preview
    ? Object.values(preview).reduce((sum, arr) => sum + arr.length, 0)
    : 0

  const hasLocalData = preview && totalItems > 0

  return (
    <div>
      <Navbar />
      <div className="max-w-2xl mx-auto px-8 py-10 space-y-6">
        <div>
          <h1 className="text-lg font-medium tracking-tight">資料匯入</h1>
          <p className="text-xs text-muted-foreground mt-1">
            將本機暫存資料（localStorage）匯入到 Supabase 帳號
          </p>
        </div>

        {status === 'idle' && (
          <Card className="p-6 border-border bg-card space-y-4">
            <p className="text-sm text-muted-foreground">
              點擊下方按鈕掃描本機資料，確認後即可匯入到你的帳號。
            </p>
            <Button onClick={handlePreview}>掃描本機資料</Button>
          </Card>
        )}

        {status === 'confirming' && (
          <Card className="p-6 border-border bg-card space-y-5">
            {hasLocalData ? (
              <>
                <div>
                  <p className="text-sm font-medium mb-3">找到以下資料：</p>
                  <div className="space-y-1.5">
                    {TABLES.map(table => (
                      <div key={table} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-muted-foreground">{table}</span>
                        <span className={preview[table].length > 0 ? 'text-foreground' : 'text-muted-foreground'}>
                          {preview[table].length} 筆
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded px-3 py-2">
                  <p className="text-xs text-yellow-400">
                    匯入前請確認已登入正確帳號。資料將綁定到目前登入的帳號，此操作無法復原。
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleImport}>確認匯入（{totalItems} 筆）</Button>
                  <Button variant="outline" onClick={() => setStatus('idle')}>取消</Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">本機沒有找到可匯入的資料。</p>
                <p className="text-xs text-muted-foreground mt-1">
                  如果你的資料存在其他瀏覽器，請在該瀏覽器執行匯入。
                </p>
              </div>
            )}
          </Card>
        )}

        {(status === 'importing' || status === 'done' || status === 'error') && (
          <Card className="p-6 border-border bg-card space-y-4">
            <p className="text-xs font-mono tracking-widest uppercase text-muted-foreground mb-3">
              {status === 'importing' ? '匯入中...' : status === 'done' ? '匯入完成' : '匯入失敗'}
            </p>
            <div className="space-y-1">
              {log.map((line, i) => (
                <p key={i} className="text-xs font-mono text-muted-foreground">{line}</p>
              ))}
            </div>
            {error && (
              <p className="text-xs text-destructive font-mono">{error}</p>
            )}
            {status === 'done' && (
              <a href="/" className="inline-block">
                <Button>前往個案列表 →</Button>
              </a>
            )}
            {status === 'error' && (
              <Button variant="outline" onClick={() => setStatus('idle')}>重試</Button>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
