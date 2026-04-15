-- ============================================
-- 教學管理系統 Supabase Schema v2
-- 多租戶 SaaS 版本（含 user_id + RLS）
-- 在 Supabase Dashboard > SQL Editor 執行
-- ============================================

-- profiles 表（每位老師的設定，含 LINE User ID）
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  line_user_id text unique,
  created_at timestamptz default now()
);

-- 個案主表
create table if not exists clients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  project_name text,
  current_stage text default 'stage1' check (current_stage in ('preparation', 'stage1', 'stage2', 'stage3', 'completed')),
  personality text,
  situation text,
  skills text,
  goals text[],
  next_session_date timestamptz,
  created_at timestamptz default now()
);

-- 第一階段：模擬諮詢
create table if not exists consultations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  date timestamptz,
  summary text,
  tech_level text check (tech_level in ('beginner', 'intermediate', 'advanced')),
  weekly_hours text,
  tools text,
  project_proposals text[],
  next_session_date timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- 第二階段：每次課程紀錄
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  session_number integer not null,
  date timestamptz,
  objectives text,
  progress text,
  notes text,
  created_at timestamptz default now()
);

-- 作業清單
create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  description text not null,
  completed boolean default false,
  source text default 'session' check (source in ('stage1', 'session')),
  created_at timestamptz default now()
);

-- 第三階段：成果報告
create table if not exists reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  date timestamptz,
  project_overview text,
  achievements text,
  highlights text,
  improvements text,
  tech_mastery text,
  self_learning text,
  application_potential text,
  recommendations text,
  summary text,
  created_at timestamptz default now()
);

-- ============================================
-- RLS（Row Level Security）
-- 每位老師只能看到自己的資料
-- ============================================

alter table profiles enable row level security;
create policy "owner_only" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

alter table clients enable row level security;
create policy "owner_only" on clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table consultations enable row level security;
create policy "owner_only" on consultations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table sessions enable row level security;
create policy "owner_only" on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table tasks enable row level security;
create policy "owner_only" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table reports enable row level security;
create policy "owner_only" on reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================
-- Trigger：新用戶註冊時自動建立 profile
-- ============================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================
-- 如果資料表已存在（舊版 schema），執行以下 migration
-- 若是全新安裝，可略過此區段
-- ============================================

-- alter table clients      add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;
-- alter table consultations add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;
-- alter table sessions      add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;
-- alter table tasks         add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;
-- alter table reports       add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete cascade;
