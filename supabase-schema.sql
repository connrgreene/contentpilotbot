-- Run once in your Supabase SQL editor

-- ── Pages registry ────────────────────────────────────────────────────────────
-- One row per registered Telegram chat / Instagram page
CREATE TABLE IF NOT EXISTS pages (
  id             BIGSERIAL PRIMARY KEY,
  chat_id        TEXT UNIQUE NOT NULL,   -- Telegram chat ID (string)
  chat_title     TEXT,                   -- Telegram chat display name
  handle         TEXT NOT NULL,          -- Instagram handle e.g. @goal
  niche          TEXT NOT NULL,          -- e.g. Football, Music, Humor
  content_focus  TEXT,                   -- Optional freeform focus description
  system_prompt  TEXT,                   -- AI-generated page-specific guidance
  emoji          TEXT DEFAULT '📄',
  color          TEXT DEFAULT '#7c6fff',
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Reviews log ───────────────────────────────────────────────────────────────
-- Every auto-review the bot performs
CREATE TABLE IF NOT EXISTS reviews (
  id                 BIGSERIAL PRIMARY KEY,
  chat_id            TEXT NOT NULL,
  handle             TEXT NOT NULL,
  content            TEXT,
  fact_verdict       TEXT,
  copyright_verdict  TEXT,
  source_verdict     TEXT,
  reviewed_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Generations log ───────────────────────────────────────────────────────────
-- Every super post batch generated
CREATE TABLE IF NOT EXISTS generations (
  id            BIGSERIAL PRIMARY KEY,
  chat_id       TEXT NOT NULL,
  handle        TEXT NOT NULL,
  title         TEXT,
  hook          TEXT,
  items         TEXT[],
  tone          TEXT,
  seed_topic    TEXT,
  rating        INT DEFAULT 0,
  generated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS pages_chat_id_idx       ON pages(chat_id);
CREATE INDEX IF NOT EXISTS reviews_chat_id_idx     ON reviews(chat_id);
CREATE INDEX IF NOT EXISTS reviews_handle_idx      ON reviews(handle);
CREATE INDEX IF NOT EXISTS generations_chat_id_idx ON generations(chat_id);
CREATE INDEX IF NOT EXISTS generations_handle_idx  ON generations(handle);

