import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '')
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navLink = (to, label, exact = false) => {
    const active = exact ? pathname === to : pathname.startsWith(to)
    return (
      <Link
        to={to}
        className={`text-xs font-mono tracking-widest uppercase transition-colors duration-200 ${
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="border-b border-border">
      <div className="max-w-6xl mx-auto px-8 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link
          to="/"
          className="font-display text-base font-medium tracking-tight text-foreground hover:text-primary transition-colors duration-200"
        >
          教學管理系統
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-8">
          {navLink('/', '個案列表', true)}
          {navLink('/calendar', '課程日曆')}
          {navLink('/ai', 'AI 助理')}
        </div>

        {/* User */}
        <div className="flex items-center gap-4">
          {email && (
            <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px]">
              {email}
            </span>
          )}
          <Link
            to="/settings"
            className={`text-xs font-mono tracking-widest uppercase transition-colors duration-200 ${
              pathname === '/settings' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            設定
          </Link>
          <button
            onClick={handleLogout}
            className="text-xs font-mono tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            登出
          </button>
        </div>
      </div>
    </nav>
  )
}
