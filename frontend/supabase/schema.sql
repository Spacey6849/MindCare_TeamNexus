-- -------------------------------
-- MindCareAI Supabase schema (updated v2)
-- - Rename profiles -> users (app-level users linked to auth.users)
-- - Add email verification fields (is_email_verified, email_verification_token, token_expires_at)
-- - Add admin_accounts, sessions, chat_messages
-- - Keep FKs inline in CREATE TABLE
-- - updated_at trigger and helper utilities included
-- -------------------------------

-- Enable gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- updated_at helper function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------- users (signup/login) ----------
-- Replaces previous "profiles" table; stores app-specific user profile linked to auth.users.id
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,                       -- intended to match auth.users.id (Supabase)
  email text UNIQUE,
  full_name text,
  roll_number text,
  institute_name text,
  avatar_url text,
  password_hash text,                        -- for custom auth (public.users only)
  role text DEFAULT 'student',               -- 'student','counselor','admin'
  is_email_verified boolean DEFAULT false,
  email_verification_token text,
  token_expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users (LOWER(email));

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON public.users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Optional: auto-create profile when auth.users row is created
-- (Requires permission to create triggers referencing auth.users)
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Run as function owner to ensure the insert into public.users succeeds even when
  -- the calling role (auth) has RLS restrictions. The function should be owned by
  -- a privileged role (the role that creates this function in the SQL editor).
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, NOW(), NOW());
  END IF;
  RETURN NEW;
END;
$$;

-- ---------- migration helper: ensure columns exist and backfill from metadata ----------
-- These ALTERs are safe to re-run; they won't drop data. Run this block once in Supabase SQL editor
-- if your existing database was created before password/email verification columns were added.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_email_verified boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verification_token text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Backfill from metadata if an earlier app version stored these there
UPDATE public.users
SET password_hash = COALESCE(password_hash, metadata->>'password_hash')
WHERE (metadata ? 'password_hash') AND password_hash IS NULL;

UPDATE public.users
SET is_email_verified = COALESCE(is_email_verified, (metadata->>'is_email_verified')::boolean)
WHERE (metadata ? 'is_email_verified') AND is_email_verified IS NULL;

UPDATE public.users
SET email_verification_token = COALESCE(email_verification_token, metadata->>'email_verification_token')
WHERE (metadata ? 'email_verification_token') AND email_verification_token IS NULL;

-- Optional: if you want to clean metadata keys after backfill, uncomment the line below
-- UPDATE public.users SET metadata = metadata - 'password_hash' - 'is_email_verified' - 'email_verification_token'
-- WHERE (metadata ? 'password_hash') OR (metadata ? 'is_email_verified') OR (metadata ? 'email_verification_token');

-- Allow the auth role to execute this SECURITY DEFINER function so the trigger can call it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'auth') THEN
    GRANT EXECUTE ON FUNCTION public.handle_auth_user_created() TO auth;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace n
    JOIN pg_catalog.pg_class c ON n.oid = c.relnamespace
    WHERE n.nspname = 'auth' AND c.relname = 'users'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auth_user_created'
    ) THEN
      CREATE TRIGGER trg_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_auth_user_created();
    END IF;
  END IF;
END;
$$;

-- ---------- admin_accounts ----------
-- Dedicated admin credentials if you want separate admin identities
CREATE TABLE IF NOT EXISTS public.admin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_admin_accounts_set_updated_at ON public.admin_accounts;
CREATE TRIGGER trg_admin_accounts_set_updated_at
BEFORE UPDATE ON public.admin_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Verify admin login via username + password using pgcrypto's crypt().
-- SECURITY DEFINER allows anon/authenticated to execute while password hash stays in DB.
CREATE OR REPLACE FUNCTION public.verify_admin_login(p_username text, p_password text)
RETURNS TABLE(id uuid, username text, email text, full_name text, role text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE acc public.admin_accounts%ROWTYPE;
BEGIN
  SELECT * INTO acc FROM public.admin_accounts a WHERE a.username = p_username;
  IF NOT FOUND THEN
    RETURN; -- no rows
  END IF;
  IF acc.password_hash = crypt(p_password, acc.password_hash) THEN
    RETURN QUERY SELECT acc.id, acc.username, acc.email, acc.full_name, acc.role;
  END IF;
END; $$;

-- Grant execute to anon/authenticated so the frontend can call via supabase.rpc
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.verify_admin_login(text, text) TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.verify_admin_login(text, text) TO authenticated;
  END IF;
END $$;

-- ---------- counselors ----------
CREATE TABLE IF NOT EXISTS public.counselors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialization text,
  available_slots jsonb DEFAULT '[]'::jsonb,   -- example: [{"start":"...","end":"..."}]
  is_available boolean DEFAULT TRUE,
  bio text,
  experience_years int,
  contact_email text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counselors_is_available ON public.counselors (is_available);

DROP TRIGGER IF EXISTS trg_counselors_set_updated_at ON public.counselors;
CREATE TRIGGER trg_counselors_set_updated_at
BEFORE UPDATE ON public.counselors
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- posts (community) ----------
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  preview text,
  category text,
  tags text[] DEFAULT ARRAY[]::text[],
  is_pinned boolean DEFAULT FALSE,
  likes_count int4 DEFAULT 0,
  replies_count int4 DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_fulltext ON public.posts USING gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')));

DROP TRIGGER IF EXISTS trg_posts_set_updated_at ON public.posts;
CREATE TRIGGER trg_posts_set_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- resources ----------
CREATE TABLE IF NOT EXISTS public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text,                -- 'article','video','pdf','link'
  category text,
  content_url text,
  thumbnail_url text,
  is_featured boolean DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_type_category ON public.resources (type, category);

DROP TRIGGER IF EXISTS trg_resources_set_updated_at ON public.resources;
CREATE TRIGGER trg_resources_set_updated_at
BEFORE UPDATE ON public.resources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- bookings ----------
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  counselor_id uuid REFERENCES public.counselors(id) ON DELETE SET NULL,
  session_date timestamptz NOT NULL,
  session_type text,
  status text NOT NULL DEFAULT 'pending',        -- 'pending','confirmed','cancelled','completed'
  notes text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_bookings_status CHECK (status IN ('pending','confirmed','cancelled','completed'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_counselor_sessiondate ON public.bookings (counselor_id, session_date);

DROP TRIGGER IF EXISTS trg_bookings_set_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_set_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- sessions (app sessions) ----------
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  refresh_token text,                         -- optional if you implement refresh flow
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON public.sessions (user_id, expires_at);

-- ---------- chat_messages (chat history) ----------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name text,                              -- denormalized for quick display
  role text NOT NULL,                          -- 'user' | 'admin' | 'assistant'
  message text,                                -- user's message
  ai_response text,                            -- model response
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON public.chat_messages (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.increment_post_likes(p_post_id uuid, p_delta int DEFAULT 1)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.posts SET likes_count = GREATEST(0, coalesce(likes_count,0) + p_delta) WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_post_replies(p_post_id uuid, p_delta int DEFAULT 1)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.posts SET replies_count = GREATEST(0, coalesce(replies_count,0) + p_delta) WHERE id = p_post_id;
END;
$$;

-- ---------- post_likes ----------
CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes (post_id);

-- ---------- post_replies ----------
CREATE TABLE IF NOT EXISTS public.post_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  is_anonymous boolean DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_replies_post_id ON public.post_replies (post_id);

DROP TRIGGER IF EXISTS trg_post_replies_set_updated_at ON public.post_replies;
CREATE TRIGGER trg_post_replies_set_updated_at
BEFORE UPDATE ON public.post_replies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

