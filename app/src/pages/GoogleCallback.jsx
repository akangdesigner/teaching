import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exchangeGoogleCode } from '../lib/googleSync'

export default function GoogleCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('connecting') // connecting | success | error
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const errParam = params.get('error')

    if (errParam) {
      setStatus('error')
      setError('Google 授權被取消')
      return
    }

    if (!code) {
      setStatus('error')
      setError('未收到授權碼')
      return
    }

    exchangeGoogleCode(code)
      .then(() => {
        setStatus('success')
        setTimeout(() => navigate('/settings'), 1500)
      })
      .catch(e => {
        setStatus('error')
        setError(e.message)
      })
  }, [])

  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center space-y-3">
        {status === 'connecting' && (
          <>
            <div className="w-6 h-6 border-2 border-foreground border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">正在連結 Google Calendar...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <p className="text-sm text-green-400">✓ Google Calendar 連結成功</p>
            <p className="text-xs text-muted-foreground">正在跳轉...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-sm text-red-400">連結失敗：{error}</p>
            <button
              onClick={() => navigate('/settings')}
              className="text-xs text-muted-foreground underline"
            >
              返回設定
            </button>
          </>
        )}
      </div>
    </div>
  )
}
