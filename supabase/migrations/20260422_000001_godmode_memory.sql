-- Godmode Engine v2 — two-ring memory + custom_techniques stub.
-- See docs/superpowers/specs/2026-04-22-godmode-engine-v2-design.md §6.

CREATE TABLE attempt_memory_private (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_family    TEXT NOT NULL,           -- 'claude' | 'gpt' | 'gemini' | 'llama' | 'kimi' | 'unknown'
  mutator_id      TEXT NOT NULL DEFAULT '',
  classifier_id   TEXT NOT NULL DEFAULT '',
  wrapper_id      TEXT NOT NULL DEFAULT '',
  mode_id         TEXT NOT NULL DEFAULT '',
  prefill_id      TEXT NOT NULL DEFAULT '',
  temp_bucket     TEXT NOT NULL,           -- 'low' | 'med' | 'high'
  technique_source TEXT NOT NULL DEFAULT 'builtin', -- 'builtin' | 'custom'
  task_text       TEXT,                    -- nullable for forward-compat; phase-1 always populated
  tier            TEXT NOT NULL,           -- 'refusal'|'evasive'|'partial'|'substantive'|'compliant'
  score_numeric   REAL NOT NULL,           -- 0.0–1.0, derived from tier
  failure_reason  TEXT,                    -- nullable; 'timeout'|'api_error'|'cancelled' when infra failed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '90 days')
);

CREATE INDEX idx_priv_user_model_dna ON attempt_memory_private
  (user_id, model_family, mutator_id, classifier_id, wrapper_id, mode_id, prefill_id, temp_bucket)
  WHERE failure_reason IS NULL;

CREATE INDEX idx_priv_expires ON attempt_memory_private (expires_at);

CREATE TABLE attempt_memory_global (
  id              BIGSERIAL PRIMARY KEY,
  model_family    TEXT NOT NULL,
  mutator_id      TEXT NOT NULL DEFAULT '',
  classifier_id   TEXT NOT NULL DEFAULT '',
  wrapper_id      TEXT NOT NULL DEFAULT '',
  mode_id         TEXT NOT NULL DEFAULT '',
  prefill_id      TEXT NOT NULL DEFAULT '',
  temp_bucket     TEXT NOT NULL,
  technique_source TEXT NOT NULL DEFAULT 'builtin',
  tier            TEXT NOT NULL,
  score_numeric   REAL NOT NULL,
  failure_reason  TEXT,
  created_day     DATE NOT NULL DEFAULT CURRENT_DATE  -- day-granularity only, not a full timestamp
  -- NOTE: no user_id column. Defense-in-depth against PII leaks.
  -- NOTE: no task_text column. Defense-in-depth.
);

CREATE INDEX idx_glob_model_dna ON attempt_memory_global
  (model_family, mutator_id, classifier_id, wrapper_id, mode_id, prefill_id, temp_bucket)
  WHERE failure_reason IS NULL;

-- custom_techniques: user-authored technique definitions.
-- category values MUST match the runtime TechniqueCategory union established in Task 1:
--   'mutate' | 'classifier' | 'prefill' | 'composite' | 'mode'
-- (The design spec §6 listed older loose names like 'mutator'/'wrapper'; the actual
--  TechniqueCategory values from app/src/lib/chat/techniques/types.ts are authoritative.)
CREATE TABLE custom_techniques (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL,        -- 'mutate' | 'classifier' | 'prefill' | 'composite' | 'mode'
  owner_user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public       BOOLEAN NOT NULL DEFAULT false,
  system_prompt   TEXT,                 -- for mutator/classifier/mode
  user_message    TEXT,                 -- for wrapper with {task} placeholder
  prefill_pair    JSONB,                -- for prefill: {role,content}[] pair
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
