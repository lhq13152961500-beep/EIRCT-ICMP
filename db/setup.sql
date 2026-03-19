-- =============================================
-- 乡音伴路 App - 数据库初始化脚本
-- 在你的 PostgreSQL 数据库中执行此脚本即可创建所有必要的表
-- =============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

-- 用户资料表
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  bio TEXT,
  gender TEXT,
  birth_year TEXT,
  birth_month TEXT,
  region TEXT,
  phone TEXT,
  address TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 声音录音表
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  title TEXT NOT NULL,
  location_name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author TEXT NOT NULL,
  quote TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  audio_data TEXT,
  audio_url TEXT,
  image_uri TEXT
);

-- 点赞表
CREATE TABLE IF NOT EXISTS recording_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recording_id, user_id)
);

-- 评论表
CREATE TABLE IF NOT EXISTS recording_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  voice_url TEXT,
  voice_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
