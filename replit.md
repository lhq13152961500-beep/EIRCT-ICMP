# 乡音伴旅 (Xiangyin Banlu)

A beautiful Chinese cultural travel mobile app built with Expo React Native + Express backend.

## Architecture

- **Frontend**: Expo Router with file-based routing, React Native
- **Backend**: Express.js server on port 5000
- **State**: React Context + React Query for server state
- **Navigation**: Tab-based with 5 tabs + center mic tab

## App Structure

```
app/
  _layout.tsx           # Root layout with QueryClient, gesture, keyboard providers
  (tabs)/
    _layout.tsx         # Tab layout (NativeTabs on iOS 26+, ClassicTabs fallback)
    index.tsx           # 首页 - Home screen with search, categories, hot spots
    guide.tsx           # 游游指南 - Tour guide (main feature screen)
    mic.tsx             # 语音助手 - Center mic tab
    voice.tsx           # 声音日记 - Voice diary screen
    profile.tsx         # 我的 - Profile screen
constants/
  colors.ts             # Natural green/earthy color palette
assets/images/
  hero-landscape.png    # AI-generated countryside landscape
  icon.png              # AI-generated app icon
  route-thumb-1.png     # Route thumbnail 1
  route-thumb-2.png     # Route thumbnail 2
```

## Design System

- Primary color: #3DAA6F (forest green)
- Accent color: #F5974E (warm orange)
- Lavender: #9B8EC4
- Background: #F8F9FA (light gray)
- Route card background: #F5F0E8 (warm beige)

## Features

### 首页 (Home)
- Green gradient header with greeting and search bar
- 4 category quick access icons (景点, 路线, 美食, 住宿)
- Horizontal scrollable hot spots section
- Today's recommended activities list

### 游游指南 (Tour Guide) - Main Feature
- Full-width landscape hero image with overlay
- Location pill + search button in hero
- 智能伴游 and AR实景畅游 feature cards
- Quick access buttons: 村民伴游, 特产礼品, 乡音趣采
- 3 tour routes in warm beige card container
- "创建我的行程" (Create My Itinerary) button
- Expert guide horizontal scroll section

### 声音日记 (Voice Diary)
- Purple/lavender gradient header
- Record new diary button
- Stats bar (entries, total duration, locations)
- Diary entry list with play buttons
- Recordings persisted to PostgreSQL (recordings table) — survive server restarts
- Supabase Storage bucket "audio" (public, 10MB limit):
  - `recordings/` — 声音作品音频文件 (m4a/webm/ogg)
  - `comments/` — 评论语音音频文件 (m4a/webm/ogg)
- Audio URLs saved in PostgreSQL: recordings.audio_url, recording_comments.voice_url
- Legacy base64 audio in recordings.audio_data still supported (fallback proxy at /api/recordings/:id/audio)
- Likes & comments stored in PostgreSQL (recording_likes, recording_comments tables)
- API: POST /api/recordings/:id/like (toggle), POST /api/recordings/:id/comment (accepts voiceData base64), GET /api/recordings/my/:userId
- RecordingsContext auto-fetches user's recordings from server every 15s
- Nearby recordings include like counts, comments, and user's liked status
- Likes/comments sync between "我的日记" and "发现他人声音"

### 我的 (Profile)
- Green gradient header with avatar
- User stats bar (visited places, check-ins, diaries, itineraries)
- Menu groups: travel, tools, about
- Account switching with multi-account support (add account flows through signin)
- Account security page: 换绑手机, 绑定邮箱, 实名认证, 第三方账号绑定(微信/QQ/支付宝), 登录设备管理

## Auth & User Display

- Auth: Supabase `users` table (phone-SMS + password login modes)
- Profiles: Local PostgreSQL `profiles` table with `display_name`, `phone`, `avatar_url`
- Display name priority: `profile?.displayName || user?.username || "我"`
- Phone-SMS login stores phone as `username` — always use display name from profile

## AI Companion (小乡伴游) Architecture

### Voice Interaction Pipeline
```
Record audio (m4a, 5s)
  ↓
[Path A] Doubao S2S WebSocket (wss://openspeech.bytedance.com/api/v3/realtime/dialogue)
  → ASR (event 451) + LLM (event 550) + TTS (event audio)
  → If S2S returns audio: play via playDoubaoAudio()
  → If S2S returns empty: fall through to Path B

[Path B] Whisper ASR (/api/ai/transcribe via Groq or OpenAI)
  → ARK LLM (/api/ai/chat, doubao-seed-2-0-lite-260215)
  → speakReply(): tries Doubao HTTP TTS → falls back to Expo Speech
```

### API Keys & Services
- `ARK_API_KEY`: Doubao LLM (doubao-seed-2-0-lite-260215) — **working**
- `VOLCENGINE_APP_ID` + `VOLCENGINE_ACCESS_TOKEN`: Doubao S2S + HTTP TTS
  - S2S: connects OK but returns empty responses (WS code 1006)
  - HTTP TTS: `code=3001 resource not granted` — NOT activated
- `GROQ_API_KEY`: Whisper ASR — **working**

### Emotion/Activity Context
- `emotionRef`, `activityHintRef`, `stepRateRef` — live refs updated from ActivityContext
- Every S2S call includes: `emotion`, `location`, `activityHint`, `stepRate`
- `buildSystemPrompt()` in `server/doubao-realtime.ts` generates context-aware prompts
- Proactive silence detection: 2 silent rounds → emotion-based proactive message

### TTS Status
Doubao HTTP TTS (`volcano_mega`/`volcano_tts`) is unavailable (code 3001).
`speakReply()` auto-falls back to `expo-speech` device TTS.

## Technical Notes

- `expo-file-system` import MUST use `from "expo-file-system/legacy"` (non-legacy API deprecated)
- `readAudioBase64(uri)`: tries `FileSystem.readAsStringAsync` first, falls back to `fetch+FileReader`
- Audio URLs: recordings in `recordings/*.m4a`, comments in `comments/*.m4a` on Supabase Storage
- `apiRequest` returns `Response` — always call `.json()` to parse
- Chinese quotes inside JS strings: use `「...」` NOT `"..."` or `"..."`

## Workflows

- `Start Backend`: Express server (port 5000)
- `Start Frontend`: Expo dev server (port 8081)
