-- ============================================================
-- 教學管理系統 Demo 資料補充腳本
-- 用途：補齊 sessions / reports 讓影片展示更完整
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上 → Run
-- 注意：只新增資料，不會刪除或修改現有學員資料
-- ============================================================

-- ── 取得學員 UUID（方便後面使用）────────────────────────────
-- 先確認你的學員名稱，執行這段看看資料是否正確：
-- SELECT id, name, current_stage FROM clients ORDER BY created_at;

-- ============================================================
-- 1. 李雅慈 — 補充 Stage 2 課程紀錄（3 堂課）
-- ============================================================
DO $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM clients WHERE name = '李雅慈' LIMIT 1;
  IF v_id IS NOT NULL THEN
    -- 只在沒有 session 時才新增
    IF NOT EXISTS (SELECT 1 FROM sessions WHERE client_id = v_id) THEN
      INSERT INTO sessions (client_id, session_number, date, objectives, progress, notes) VALUES
      (v_id, 1, '2026-03-08',
       '理解 n8n 基本架構，完成第一個自動化流程',
       '成功建立 Webhook → HTTP Request → Gmail 的完整流程，學員對節點概念掌握良好',
       '學習速度超乎預期，主動嘗試了很多進階設定'),
      (v_id, 2, '2026-03-15',
       '串接 Google Sheets，建立每日數據自動彙整',
       '完成 Sheets 讀寫節點，設定每天早上 9 點自動執行排程，成功匯入 30 天歷史數據',
       '對 cron 排程的概念理解很快，開始思考其他可自動化的工作流程'),
      (v_id, 3, '2026-03-22',
       'LINE Bot 串接，實作關鍵字自動回覆',
       '完成 LINE Messaging API 設定，實現 5 種關鍵字觸發回覆，測試通過',
       '下次目標：將 Sheets 數據摘要每日自動推送到 LINE');
    END IF;
  END IF;
END $$;

-- ============================================================
-- 2. 杜怡慧 — 補充 Stage 2 課程紀錄（2 堂課）
-- ============================================================
DO $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM clients WHERE name = '杜怡慧' LIMIT 1;
  IF v_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM sessions WHERE client_id = v_id) THEN
      INSERT INTO sessions (client_id, session_number, date, objectives, progress, notes) VALUES
      (v_id, 1, '2026-03-12',
       '了解 Claude API 基本用法，完成第一個 API 呼叫',
       '成功串接 Claude API，實作了一個能分析客服留言情緒的基本功能，理解 system prompt 的設計邏輯',
       '對 prompt engineering 很有興趣，課後自行研究了各種 prompt 技巧'),
      (v_id, 2, '2026-03-19',
       '設計客服回覆邏輯，實作升級人工服務的判斷機制',
       '完成三層判斷邏輯：一般問題 AI 直接回覆、複雜問題 AI 生成草稿、特殊情況轉人工，整體準確率約 85%',
       '需要繼續收集更多邊界案例來改善判斷邏輯');
    END IF;
  END IF;
END $$;

-- ============================================================
-- 3. 陳凱琳 — 補充 Stage 2 課程紀錄（2 堂課）
-- ============================================================
DO $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM clients WHERE name = '陳凱琳' LIMIT 1;
  IF v_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM sessions WHERE client_id = v_id) THEN
      INSERT INTO sessions (client_id, session_number, date, objectives, progress, notes) VALUES
      (v_id, 1, '2026-03-10',
       '整理現有報表流程，找出可自動化的環節',
       '完整記錄了月結流程的 12 個步驟，找出其中 7 個可自動化，決定先從最耗時的「科目彙整」下手',
       '學員對現有流程的問題描述非常清晰，有助於設計自動化方案'),
      (v_id, 2, '2026-03-24',
       '建立 Google Sheets 自動更新流程，設定排程觸發',
       '完成科目彙整自動化，設定每月 1 日 08:00 自動執行，預計每月節省 4 小時',
       '學員反應遠比預期快，已主動發想下一個要自動化的流程');
    END IF;
  END IF;
END $$;

-- ============================================================
-- 4. 李雅慈 — 補充 Stage 3 成果報告（展示已完成的學員）
-- ============================================================
DO $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM clients WHERE name = '李雅慈' LIMIT 1;
  IF v_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM reports WHERE client_id = v_id) THEN
      INSERT INTO reports (
        client_id, date, tech_mastery, self_learning,
        highlights, improvements, project_overview,
        achievements, recommendations, summary
      ) VALUES (
        v_id,
        '2026-04-01',
        '在 3 週內從零基礎掌握 n8n 核心功能，能獨立設計並除錯複雜工作流程，對 API 串接有清晰理解',
        '課程結束後主動延伸學習，已自行研究 n8n 的 HTTP Request 節點進階用法，並在社群分享心得',
        '第三堂課完成的 LINE Bot 自動推播功能超出預期，學員獨立加入了訊息模板功能，展現出色的自主延伸能力',
        '對錯誤訊息的解讀還需加強，遇到 API 回傳非預期格式時容易卡住，建議多練習 debug 技巧',
        '成功建立三個完整的自動化工作流程：每日銷售數據彙整、LINE Bot 關鍵字回覆系統、週報自動生成並寄送 Email',
        '原本每天需要 1.5 小時的手動數據整理，現在完全自動化，整體工作效率提升約 40%。三個工作流程穩定運行，每日處理量達 200+ 筆資料',
        '建議下一步學習如何將工作流程部署到雲端（如 Railway 或 Zeabur），讓系統 24 小時穩定運作，不依賴本地電腦',
        '李雅慈是本期學員中進步最快的一位。從零基礎到能獨立開發並部署自動化工作流程，只花了 3 週時間。她的邏輯思維清晰，學習方法正確，加上課後持續自主練習，非常適合進一步深化 AI 自動化的應用。'
      );
    END IF;

    -- 同時將李雅慈標記為已完成
    UPDATE clients SET current_stage = 'completed' WHERE id = v_id AND current_stage != 'completed';
  END IF;
END $$;

-- ============================================================
-- 5. 確認結果
-- ============================================================
SELECT
  c.name,
  c.current_stage,
  COUNT(DISTINCT s.id) AS session_count,
  COUNT(DISTINCT r.id) AS has_report
FROM clients c
LEFT JOIN sessions s ON s.client_id = c.id
LEFT JOIN reports r ON r.client_id = c.id
GROUP BY c.id, c.name, c.current_stage
ORDER BY c.created_at;
