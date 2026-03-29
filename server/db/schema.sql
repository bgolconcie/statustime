CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  subscription_status VARCHAR(50) DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  team_id VARCHAR(255) NOT NULL,
  team_name VARCHAR(255),
  bot_user_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, platform, team_id)
);

CREATE TABLE IF NOT EXISTS tracked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  platform_user_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  email VARCHAR(255),
  avatar_url TEXT,
  timezone VARCHAR(100) DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT true,
  user_type VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, platform_user_id)
);

CREATE TABLE IF NOT EXISTS time_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES tracked_users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  status VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES tracked_users(id) ON DELETE CASCADE,
  leave_type VARCHAR(100) DEFAULT 'vacation',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add timezone column if it does not exist (safe migration)
DO $$ BEGIN
  ALTER TABLE tracked_users ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'UTC';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Presence snapshots: one row per poll per user, used for hourly heatmap
CREATE TABLE IF NOT EXISTS presence_snapshots (
  id          BIGSERIAL PRIMARY KEY,
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES tracked_users(id) ON DELETE CASCADE,
  polled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active   BOOLEAN NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_presence_snapshots_user_polled ON presence_snapshots(user_id, polled_at);

-- Cost/price per user (safe migration)
DO $$ BEGIN
  ALTER TABLE tracked_users ADD COLUMN IF NOT EXISTS cost_type VARCHAR(10) DEFAULT 'hourly';
  ALTER TABLE tracked_users ADD COLUMN IF NOT EXISTS cost_amount NUMERIC(10,2) DEFAULT NULL;
  ALTER TABLE tracked_users ADD COLUMN IF NOT EXISTS price_type VARCHAR(10) DEFAULT 'hourly';
  ALTER TABLE tracked_users ADD COLUMN IF NOT EXISTS price_amount NUMERIC(10,2) DEFAULT NULL;
  ALTER TABLE tracked_users ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';
  ALTER TABLE tracked_users ADD COLUMN IF NOT EXISTS project_name VARCHAR(255) DEFAULT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
