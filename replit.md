# 逛游指南

A beautiful Chinese rural tourism guide mobile app built with Expo React Native.

## Architecture

- **Frontend**: Expo Router with file-based routing, React Native
- **Backend**: Express.js server on port 5000
- **State**: Local component state (no database needed)
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

### 我的 (Profile)
- Green gradient header with avatar
- User stats bar (visited places, check-ins, diaries, itineraries)
- Menu groups: travel, tools, about

## Workflows

- `Start Backend`: Express server (port 5000)
- `Start Frontend`: Expo dev server (port 8081)
