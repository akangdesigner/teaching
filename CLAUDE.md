# 教學管理系統 — 開發紀錄

## 專案概述
AI 應用 & n8n 自動化職涯家教的 1 對 1 線上教學管理系統。
用途：管理個案資料、教學計畫、課程紀錄、作業追蹤、課程日曆。

---

## 技術架構

| 項目 | 技術 |
|------|------|
| 前端框架 | Vite + React |
| UI 套件 | shadcn/ui + Tailwind CSS v4 |
| 資料庫 | Supabase (PostgreSQL) |
| 路由 | react-router-dom |
| 日曆 | react-big-calendar + date-fns |

---

## 目錄結構

```
D:/teaching/
├── CLAUDE.md                  ← 本檔案
├── README.md                  ← 使用說明
├── clients/                   ← 各個案的 Markdown 備份
│   ├── 陳凱琳/
│   ├── 杜怡慧/
│   ├── 李雅慈/
│   ├── 張剴岳/
│   └── 陳薇稜/
├── templates/                 ← 各階段 Markdown 範本
└── app/                       ← 前端專案
    ├── .env.local              ← Supabase 金鑰（已填入）
    ├── supabase_schema.sql     ← 資料庫 schema
    ├── vite.config.js
    ├── jsconfig.json           ← 路徑別名 @/ → src/
    └── src/
        ├── App.jsx             ← 路由設定
        ├── main.jsx
        ├── index.css           ← Tailwind + shadcn 樣式
        ├── lib/
        │   ├── supabase.js     ← Supabase client
        │   └── utils.js        ← shadcn 工具
        ├── components/
        │   ├── Navbar.jsx      ← 導覽列（個案列表 / 課程日曆）
        │   ├── StageTag.jsx    ← 階段標籤元件
        │   └── ui/             ← shadcn/ui 元件
        └── pages/
            ├── Dashboard.jsx   ← 個案列表 + 篩選
            ├── ClientDetail.jsx ← 個案詳細頁
            ├── ClientForm.jsx  ← 新增 / 編輯個案
            └── CalendarPage.jsx ← 課程日曆
```

---

## Supabase 資料表

| 資料表 | 說明 |
|--------|------|
| `clients` | 個案主表（基本資料、階段、下次上課時間） |
| `consultations` | 第一階段：模擬諮詢紀錄 |
| `sessions` | 第二階段：每次課程紀錄 |
| `tasks` | 作業清單（可勾選完成） |
| `reports` | 第三階段：成果報告 |

---

## 教學階段流程

```
準備階段 → 第一階段（模擬諮詢 30min）→ 第二階段（課程 1hr/堂）→ 第三階段（成果報告）→ 已完成
preparation  stage1                      stage2                    stage3               completed
```

---

## 目前個案清單

| 姓名 | 專案 | 階段 | 下次上課 |
|------|------|------|----------|
| 陳凱琳 | n8n 全方位自動化 | stage1 | 2026-04-10 22:30 |
| 杜怡慧 | AI 商務超級助理系統 | stage1 | 2026-04-08 20:00 |
| 陳薇稜 | n8n 全方位自動化 | stage1 | 2026-04-06 20:00 |
| 李雅慈 | n8n 全方位自動化 | preparation | 2026-04-01 20:00 |
| 張剴岳 | n8n 全方位自動化 | preparation | 2026-03-30 20:00 |

---

## 已完成功能

- [x] Vite + React 專案建立
- [x] Supabase 資料庫 schema 設計與建立
- [x] shadcn/ui 安裝與設定（含路徑別名 `@/`）
- [x] 個案列表頁（Dashboard）— 篩選、狀態總覽
- [x] 個案詳細頁 — 背景、作業清單勾選、各階段紀錄
- [x] 新增 / 編輯個案表單 — 含諮詢紀錄與作業，不需手動寫 SQL
- [x] 課程日曆（react-big-calendar）— 即將上課 + 已上課紀錄
- [x] 準備階段（preparation）新增至階段流程

## 待辦 / 未來功能

- [ ] UI 重新設計（風格優化）
- [ ] 第二階段課程紀錄的新增 UI（目前需手動 SQL）
- [ ] 第三階段成果報告的新增 UI
- [ ] 個案之間的進度比較
- [ ] 匯出報告（PDF）

---

## 本地啟動

```bash
cd D:/teaching/app
npm run dev
# 開啟 http://localhost:5173
```

## Supabase 資訊
- URL：`https://etufmekbfimxueszzsoi.supabase.co`
- 金鑰存放：`D:/teaching/app/.env.local`
