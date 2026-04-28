import WebSocket from "ws";
import { randomUUID } from "crypto";
import { spawn } from "child_process";

const REALTIME_WS_URL = "wss://openspeech.bytedance.com/api/v3/realtime/dialogue";
const APP_KEY = "PlgvMymc7f3tQnJ6";

// Message Types (byte 1 high nibble)
const MT_FULL_CLIENT  = 0x1;
const MT_AUDIO_CLIENT = 0x2;
const MT_AUDIO_SERVER = 0xb;
const MT_FULL_SERVER  = 0x9;
const MT_ERROR        = 0xf;

// Message Type Specific Flags (byte 1 low nibble)
// Official binary example shows flags=0b0100 (event only, NO sequence)
const FL_EVENT_ONLY = 0x4;

// Event IDs — client
const EVT_START_CONN    = 1;
const EVT_FINISH_CONN   = 2;
const EVT_START_SESSION = 100;
const EVT_FINISH_SESSION = 102;
const EVT_TASK_REQUEST  = 200;

// Event IDs — server
const EVT_CONN_STARTED  = 50;
const EVT_CONN_FAILED   = 51;
const EVT_SESSION_START = 150;
const EVT_SESSION_FAIL  = 153;
const EVT_TTS_ENDED     = 359;
const EVT_ASR_RESPONSE  = 451;
const EVT_CHAT_RESPONSE = 550;

// Built-in ICL voice for SC v1 — works without extra registration
// Switch to user's cloned voice S_hQJPcOyZ1 (SC2.0) after verifying SC v1 pipeline
export const DEFAULT_SPEAKER = "ICL_zh_female_nuanxinxuejie_tob";

// ── Binary helpers ──────────────────────────────────────────────────────────
function int32BE(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n, 0);
  return b;
}

function uint32BE(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function lenStr(s: string): Buffer {
  const sb = Buffer.from(s, "utf-8");
  return Buffer.concat([uint32BE(sb.length), sb]);
}

// Header builders — matches official binary example:
//   byte0=0x11 (version=1, header_size=1)
//   byte1=(msgType<<4)|0x04 (event-only flag, no sequence)
//   byte2=0x10 for JSON text, 0x00 for raw audio
//   byte3=0x00 (reserved)
function fullClientHdr(): Buffer {
  return Buffer.from([0x11, (MT_FULL_CLIENT << 4) | FL_EVENT_ONLY, 0x10, 0x00]);
}
function audioClientHdr(): Buffer {
  return Buffer.from([0x11, (MT_AUDIO_CLIENT << 4) | FL_EVENT_ONLY, 0x00, 0x00]);
}

// StartConnection / FinishConnection (connect-level, no session ID)
function buildConnectEvent(eventId: number): Buffer {
  const pl = Buffer.from("{}");
  return Buffer.concat([fullClientHdr(), int32BE(eventId), uint32BE(pl.length), pl]);
}

// Session-level text events (StartSession, FinishSession, etc.)
function buildSessionEvent(eventId: number, sid: string, payload: object): Buffer {
  const pl = Buffer.from(JSON.stringify(payload));
  return Buffer.concat([fullClientHdr(), int32BE(eventId), lenStr(sid), uint32BE(pl.length), pl]);
}

// Audio chunk — raw PCM, no compression, no JSON serialization
function buildAudioChunk(pcm: Buffer, sid: string): Buffer {
  return Buffer.concat([audioClientHdr(), int32BE(EVT_TASK_REQUEST), lenStr(sid), uint32BE(pcm.length), pcm]);
}

// ── Server message parser ───────────────────────────────────────────────────
interface ParsedMsg {
  msgType: number;
  eventId: number;
  payload: Buffer | Record<string, unknown>;
  errorCode?: number;
  errorText?: string;
}

function parseServerMsg(raw: Buffer): ParsedMsg {
  if (raw.length < 4) return { msgType: 0, eventId: 0, payload: Buffer.alloc(0) };

  const byte1 = raw[1];
  const msgType = (byte1 >> 4) & 0xf;
  const flags   = byte1 & 0xf;
  let off = 4; // skip 4-byte header

  // ── Error packet ──
  if (msgType === MT_ERROR) {
    let code = 0;
    if (off + 4 <= raw.length) { code = raw.readInt32BE(off); off += 4; }
    let plSize = 0;
    if (off + 4 <= raw.length) { plSize = raw.readUInt32BE(off); off += 4; }
    let errorText = "";
    if (plSize > 0 && off + plSize <= raw.length) {
      const plBuf = raw.subarray(off, off + plSize);
      try {
        const j = JSON.parse(plBuf.toString("utf-8")) as Record<string, unknown>;
        errorText = typeof j.error === "string" ? j.error : plBuf.toString("utf-8");
      } catch {
        errorText = plBuf.toString("utf-8");
      }
    }
    console.error(`[S2S] ERROR code=${code} msg=${errorText || raw.toString("hex")}`);
    return { msgType, eventId: 0, payload: Buffer.alloc(0), errorCode: code, errorText };
  }

  // ── Full-server or audio-server response ──
  if (msgType === MT_FULL_SERVER || msgType === MT_AUDIO_SERVER) {
    // Optional: negative sequence (flag bit 0x2)
    if ((flags & 0x2) !== 0) {
      if (off + 4 <= raw.length) off += 4;
    }

    // Optional: event ID (flag bit 0x4)
    let eventId = 0;
    if ((flags & 0x4) !== 0) {
      if (off + 4 <= raw.length) { eventId = raw.readInt32BE(off); off += 4; }
    }

    // Session ID — always present (size=0 for connect-level events)
    // Python parse_response always reads session_id_size unconditionally
    if (off + 4 <= raw.length) {
      const sidLen = raw.readUInt32BE(off);
      off += 4; // advance past the 4-byte size field
      if (sidLen > 0 && sidLen <= 256 && off + sidLen <= raw.length) {
        off += sidLen; // skip over session ID bytes
      }
    }

    // Payload
    let payload: Buffer | Record<string, unknown> = Buffer.alloc(0);
    if (off + 4 <= raw.length) {
      const plSize = raw.readUInt32BE(off); off += 4;
      if (plSize > 0 && off + plSize <= raw.length) {
        const plBuf = raw.subarray(off, off + plSize);
        if (msgType === MT_AUDIO_SERVER) {
          payload = plBuf; // raw audio bytes
        } else {
          try { payload = JSON.parse(plBuf.toString("utf-8")) as Record<string, unknown>; }
          catch { payload = plBuf; }
        }
      }
    }

    return { msgType, eventId, payload };
  }

  return { msgType: 0, eventId: 0, payload: Buffer.alloc(0) };
}

// ── Audio format conversion ─────────────────────────────────────────────────
async function convertM4aToPcmInMemory(m4aBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-y", "-f", "mp4", "-i", "pipe:0",
      "-ar", "16000", "-ac", "1", "-f", "s16le", "pipe:1",
    ]);
    const chunks: Buffer[] = [];
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.stdout.on("end", () => resolve(Buffer.concat(chunks)));
    proc.stderr.on("data", () => {});
    proc.on("error", reject);
    proc.stdin.write(m4aBuffer);
    proc.stdin.end();
  });
}

async function convertPcmToMp3InMemory(pcmBuffer: Buffer, sampleRate = 24000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-y",
      "-f", "s16le", "-ar", String(sampleRate), "-ac", "1",
      "-i", "pipe:0",
      "-f", "mp3", "pipe:1",
    ]);
    const chunks: Buffer[] = [];
    proc.stdout.on("data", (d: Buffer) => chunks.push(d));
    proc.stdout.on("end", () => resolve(Buffer.concat(chunks)));
    proc.stderr.on("data", () => {});
    proc.on("error", reject);
    proc.stdin.write(pcmBuffer);
    proc.stdin.end();
  });
}

// ── Persistent WebSocket connection ─────────────────────────────────────────
type MsgHandler = (msg: ParsedMsg) => void;

class PersistentRealtimeConn {
  private ws: WebSocket | null = null;
  private connStarted = false;
  private connecting: Promise<void> | null = null;
  private msgHandler: MsgHandler | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly IDLE_MS = 90_000;

  private resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      console.log("[S2S] Idle timeout — closing persistent WS");
      this.close();
    }, this.IDLE_MS);
  }

  private isReady(): boolean {
    return !!(this.ws && this.ws.readyState === 1 && this.connStarted);
  }

  async ensureConnected(appId: string, token: string): Promise<void> {
    if (this.isReady()) { this.resetIdleTimer(); return; }
    if (this.connecting) return this.connecting;

    this.connStarted = false;

    this.connecting = new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(REALTIME_WS_URL, {
        headers: {
          "X-Api-App-ID":       appId,
          "X-Api-Access-Key":   token,
          "X-Api-Resource-Id":  "volc.speech.dialog",
          "X-Api-App-Key":      APP_KEY,
          "X-Api-Connect-Id":   randomUUID(),
        },
      });

      const onConnectTimeout = setTimeout(() => {
        ws.terminate();
        reject(new Error("WS connect timeout (8s)"));
      }, 8000);

      ws.on("open", () => {
        console.log("[S2S] WS open → sending StartConnection (evt=1)");
        ws.send(buildConnectEvent(EVT_START_CONN));
      });

      ws.on("message", (raw: Buffer) => {
        const msg = parseServerMsg(raw);

        if (!this.connStarted) {
          if (msg.eventId === EVT_CONN_STARTED) {
            clearTimeout(onConnectTimeout);
            console.log("[S2S] ConnectionStarted ✓ (evt=50)");
            this.ws = ws;
            this.connStarted = true;
            this.connecting = null;
            this.resetIdleTimer();
            resolve();
          } else if (msg.eventId === EVT_CONN_FAILED || msg.msgType === MT_ERROR) {
            clearTimeout(onConnectTimeout);
            this.connecting = null;
            const errMsg = msg.errorText || (msg.payload as Record<string,unknown>)?.error || "";
            reject(new Error(`ConnectionFailed evt=${msg.eventId} err=${errMsg}`));
          }
          return;
        }
        this.msgHandler?.(msg);
      });

      ws.on("error", (err) => {
        clearTimeout(onConnectTimeout);
        this.connecting = null;
        this.connStarted = false;
        reject(err);
      });

      ws.on("close", (code) => {
        console.log(`[S2S] WS closed code=${code}`);
        this.ws = null;
        this.connStarted = false;
        if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
      });
    });

    return this.connecting;
  }

  async runTurn(
    appId: string,
    token: string,
    pcmData: Buffer,
    sessionPayload: object,
    systemRole: string,
  ): Promise<S2STurnResult> {
    try {
      await this.ensureConnected(appId, token);
    } catch (e: any) {
      throw new Error(`S2S connection failed: ${e.message}`);
    }

    const ws = this.ws!;
    const sessionId = randomUUID();
    this.resetIdleTimer();

    return new Promise<S2STurnResult>((resolve) => {
      const audioChunks: Buffer[] = [];
      let transcript = "";
      let aiText = "";
      let settled = false;
      let ttsKnownFailed = false;
      let sessionStarted = false;
      let textWaitTimer: ReturnType<typeof setTimeout> | null = null;
      let postAudioTimer: ReturnType<typeof setTimeout> | null = null;

      const settle = (result: S2STurnResult) => {
        if (settled) return;
        settled = true;
        this.msgHandler = null;
        if (textWaitTimer) { clearTimeout(textWaitTimer); textWaitTimer = null; }
        if (postAudioTimer) { clearTimeout(postAudioTimer); postAudioTimer = null; }
        clearTimeout(globalTimer);
        try { ws.send(buildSessionEvent(EVT_FINISH_SESSION, sessionId, {})); } catch {}
        this.resetIdleTimer();
        resolve(result);
      };

      // 8s global safety timeout
      const globalTimer = setTimeout(() => {
        console.warn(`[S2S-Turn] Global timeout — chunks=${audioChunks.length} transcript="${transcript}" aiText="${aiText.slice(0, 40)}"`);
        settle({ audioChunks, transcript, aiText });
      }, 8000);

      const startTextWaitTimer = () => {
        if (textWaitTimer) return;
        textWaitTimer = setTimeout(() => {
          textWaitTimer = null;
          settle({ audioChunks: [], transcript, aiText });
        }, 3000);
      };

      this.msgHandler = (msg: ParsedMsg) => {
        // Error frame
        if (msg.msgType === MT_ERROR) {
          const errText = msg.errorText || "";
          if (errText.includes("InvalidSpeaker")) {
            console.warn("[S2S-Turn] InvalidSpeaker — falling back to text-only");
            ttsKnownFailed = true;
            if (aiText) settle({ audioChunks: [], transcript, aiText });
            else startTextWaitTimer();
            return;
          }
          console.error(`[S2S-Turn] fatal error: ${errText}`);
          settle({ audioChunks: [], transcript, aiText });
          return;
        }

        // Audio frame
        if (msg.msgType === MT_AUDIO_SERVER && Buffer.isBuffer(msg.payload) && (msg.payload as Buffer).length > 0) {
          if (!ttsKnownFailed) audioChunks.push(msg.payload as Buffer);
          return;
        }

        if (msg.eventId !== 0) console.log(`[S2S-Turn] evt=${msg.eventId}`);

        switch (msg.eventId) {
          case EVT_SESSION_START: { // 150
            if (sessionStarted) break;
            sessionStarted = true;
            const dialogId = (msg.payload as Record<string, unknown>)?.dialog_id ?? "";
            console.log(`[S2S-Turn] SessionStarted dialog_id=${dialogId} → streaming PCM`);
            streamPcm();
            break;
          }

          case EVT_SESSION_FAIL: { // 153
            const errPayload = msg.payload as Record<string, unknown>;
            console.error("[S2S-Turn] SessionFailed:", JSON.stringify(errPayload));
            settle({ audioChunks: [], transcript, aiText });
            break;
          }

          case EVT_ASR_RESPONSE: { // 451
            const pl = msg.payload as Record<string, unknown>;
            const results = (pl?.results as Array<{ text: string; is_interim: boolean }>) ?? [];
            const final = results.find((r) => !r.is_interim);
            if (final?.text) { transcript = final.text; console.log("[S2S-Turn] ASR:", transcript); }
            break;
          }

          case EVT_CHAT_RESPONSE: { // 550
            const pl = msg.payload as Record<string, unknown>;
            const chunk = typeof pl?.content === "string" ? pl.content : "";
            if (chunk) {
              aiText += chunk;
              if (ttsKnownFailed) {
                if (textWaitTimer) { clearTimeout(textWaitTimer); textWaitTimer = null; }
                settle({ audioChunks: [], transcript, aiText });
              }
            }
            break;
          }

          case EVT_TTS_ENDED: { // 359
            console.log(`[S2S-Turn] TTSEnded — chunks=${audioChunks.length}`);
            settle({ audioChunks, transcript, aiText });
            break;
          }

          default:
            break;
        }
      };

      // Send StartSession
      ws.send(buildSessionEvent(EVT_START_SESSION, sessionId, sessionPayload));

      // Stream PCM in 20ms chunks (640 bytes @ 16kHz int16) using setImmediate
      const CHUNK_BYTES = 640;
      const streamPcm = () => {
        let offset = 0;
        const sendNext = () => {
          if (settled) return;
          if (offset >= pcmData.length) {
            console.log("[S2S-Turn] PCM streaming done — waiting for VAD / TTS");
            postAudioTimer = setTimeout(() => {
              postAudioTimer = null;
              if (!settled && audioChunks.length === 0 && !aiText) {
                console.warn("[S2S-Turn] Post-audio timeout");
                settle({ audioChunks: [], transcript, aiText });
              }
            }, 6000);
            return;
          }
          const end = Math.min(offset + CHUNK_BYTES, pcmData.length);
          ws.send(buildAudioChunk(pcmData.subarray(offset, end), sessionId));
          offset = end;
          setImmediate(sendNext);
        };
        sendNext();
      };
    });
  }

  close() {
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.send(buildConnectEvent(EVT_FINISH_CONN));
        this.ws.close();
      } catch {}
    }
    this.ws = null;
    this.connStarted = false;
  }
}

const globalConn = new PersistentRealtimeConn();

export function closeRealtimeConn() {
  globalConn.close();
}

// ── ARK LLM text fallback ───────────────────────────────────────────────────
export async function callDoubaoLLM(userText: string, systemRole: string): Promise<string> {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) return "";
  try {
    const resp = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "doubao-seed-2-0-lite-260215",
        messages: [{ role: "system", content: systemRole }, { role: "user", content: userText }],
        max_tokens: 120,
        temperature: 0.85,
      }),
    });
    const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content || "";
  } catch (e: any) {
    console.error("[DoubaoLLM] error:", e.message);
    return "";
  }
}

// ── HTTP TTS fallback ───────────────────────────────────────────────────────
export async function callDoubaoHttpTts(text: string, appId: string, token: string): Promise<Buffer> {
  const attempts = [
    { cluster: "volcano_mega", voice_type: "BV700_V2_streaming" },
    { cluster: "volcano_tts",  voice_type: "BV700_streaming" },
  ];
  for (const { cluster, voice_type } of attempts) {
    const payload = {
      app: { appid: appId, token, cluster },
      user: { uid: "xiaoxiang_companion" },
      audio: { voice_type, encoding: "mp3", speed_ratio: 1.0, volume_ratio: 1.0, pitch_ratio: 1.0 },
      request: { reqid: randomUUID(), text: text.slice(0, 2000), text_type: "plain", operation: "query" },
    };
    try {
      const resp = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
        method: "POST",
        headers: { Authorization: `Bearer;${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json() as { code?: number; message?: string; data?: string };
      console.log(`[DoubaoTTS-HTTP] cluster=${cluster} voice=${voice_type} code=${data.code} msg=${data.message}`);
      if (data.code === 3000 && data.data) {
        return Buffer.from(data.data, "base64");
      }
    } catch (e: any) {
      console.error("[DoubaoTTS-HTTP] fetch error:", e.message);
    }
  }
  throw new Error("HTTP TTS failed all clusters");
}

// ── System prompt builder ───────────────────────────────────────────────────
export interface DoubaoS2SRequest {
  audioBase64: string;
  mimeType?: string;
  systemRole?: string;
  emotion?: string;
  location?: string;
  activityHint?: string;
  stepRate?: number;
  speaker?: string;
}

export function buildSystemPrompt(emotion?: string, location?: string, activityHint?: string, stepRate?: number): string {
  const em   = emotion      || "平静";
  const loc  = location     || "新疆吐峪沟";
  const hint = activityHint || "游览中";
  const rate = stepRate     ?? 0;

  const emotionGuides: Record<string, string> = {
    疲惫: "游客感到疲惫。语气要特别轻柔温暖，主动询问是否需要休息，推荐就近休息点（烤馕馆坐坐、瓜果长廊歇脚），话不要太多，让人放松。",
    无聊: "游客有些无聊。立刻出一道吐峪沟趣味问题，或推荐没试过的特色体验，让对话活跃起来，激发兴趣。",
    好奇: "游客好奇心旺盛！详细讲解景点背后的历史典故与趣闻细节，满足求知欲，可以多说一点。",
    开心: "游客心情很好！用活泼语气回应，分享互动体验点，推荐拍照打卡位，气氛轻松愉快。",
    愉快: "游客精力充沛！热情回应，推荐深度游览路线，激发探索欲，可连续介绍多个景点。",
    平静: "游客状态平和，轻松自然地聊，实用地回答问题，偶尔主动分享有趣的景区小知识。",
  };

  const actGuide = rate === 0
    ? "游客正在停留或静止，可主动分享一个景区趣闻或轻松小故事。"
    : rate > 80
    ? "游客正快步行走，回答要简短精练，不要占用太多时间。"
    : "游客在悠闲漫步，可以详细分享文化历史知识，节奏舒缓。";

  return `你是「小乡」，乡音伴旅App的AI旅游伴游助手，专注服务新疆吐鲁番吐峪沟景区。

【你的个性】
活泼温暖，像熟悉当地文化的好朋友。偶尔自然穿插维吾尔语：亚克西（很好）、热合买提（谢谢）、亚曼（不行）、麦西热普（聚会欢乐）。口语化表达，每次回答60字以内，像朋友聊天不像背稿。

【吐峪沟景区知识库】
①景区大门（清代石砌拱门，标志性入口）②麻扎村（千年维吾尔古村，生土建筑冬暖夏凉）③吐峪沟清真寺（精美木雕伊斯兰建筑）④千年洞窟（公元4世纪佛教石窟，丝路文化遗珍）⑤古麻扎遗址（新疆最古老伊斯兰圣祠，霍加木麻扎）⑥非遗文化馆（木卡姆音乐、都它尔、萨塔尔乐器展演）⑦民俗体验馆（纺线织毯互动体验）⑧葡萄晾房（传统土坯晾制葡萄干）⑨特产集市（葡萄干、无花果、杏干、桑葚干）⑩烤馕馆（坑炉现烤馕饼，外脆内软）⑪瓜果长廊（哈密瓜、白杏可品尝）⑫游客服务中心（导览租赁急救）

【当前游客状态】
情绪：${em} | 位置：${loc} | 游览状态：${hint}（步频约${rate}步/分钟）

【情绪响应策略】
${emotionGuides[em] || emotionGuides["平静"]}

【节奏适配策略】
${actGuide}

【核心对话原则】
1. 直接回答问题，不答非所问，不重复已知信息
2. 游客累了→立刻给休息建议；游客无聊→出趣味互动或小游戏
3. 涉及位置与距离→结合游客当前位置给出实用建议
4. 无关话题→自然引回吐峪沟旅游内容
5. 绝对不用书面语，说话像朋友，简短有温度`;
}

export interface DoubaoS2SResponse {
  audioBase64: string;
  format: string;
  transcript?: string;
  aiText?: string;
}

interface S2STurnResult {
  audioChunks: Buffer[];
  transcript: string;
  aiText: string;
}

export async function doublaoRealtimeTurn(req: DoubaoS2SRequest): Promise<DoubaoS2SResponse> {
  const appId       = process.env.VOLCENGINE_APP_ID;
  const accessToken = process.env.VOLCENGINE_ACCESS_TOKEN;
  if (!appId || !accessToken) throw new Error("Doubao credentials not configured");

  // Convert M4A/AAC recording to PCM 16kHz int16 mono
  const m4aBuffer = Buffer.from(req.audioBase64, "base64");
  const pcmData = await convertM4aToPcmInMemory(m4aBuffer);
  console.log(`[S2S-Turn] PCM: ${pcmData.length}B (~${(pcmData.length / 32000).toFixed(1)}s)`);

  const systemRole    = req.systemRole || buildSystemPrompt(req.emotion, req.location, req.activityHint, req.stepRate);
  const speakerToUse  = req.speaker || DEFAULT_SPEAKER;

  // ── Session payload — official asr/tts/dialog format ────────────────────
  // References:
  //   - SC版本 uses character_manifest (plain string) in dialog
  //   - SC版本 supports ICL_ prefix voices (built-in clone voices)
  //   - model field inside dialog.extra: "1.2.1.1"=O2.0, "2.2.0.0"=SC2.0
  //   - SC v1 (ICL_ voices) → omit model field
  //   - input_mod: "audio_file" since we send pre-recorded audio (server adds silence)
  // ─────────────────────────────────────────────────────────────────────────
  const sessionPayload = {
    asr: {
      extra: {
        end_smooth_window_ms: 1500,
      },
    },
    tts: {
      speaker: speakerToUse,
      audio_config: {
        channel: 1,
        format: "pcm",        // PCM float32 24kHz (server default for SC)
        sample_rate: 24000,
      },
    },
    dialog: {
      character_manifest: systemRole, // Plain string for SC版本
      location: {
        city: "新疆吐鲁番",
        district: "吐峪沟",
      },
      extra: {
        strict_audit: false,
        recv_timeout: 10,
        input_mod: "audio_file", // pre-recorded audio, server adds silence for VAD
      },
    },
  };

  console.log(`[S2S-Turn] speaker="${speakerToUse}" pcm=${pcmData.length}B`);

  const result = await globalConn.runTurn(appId, accessToken, pcmData, sessionPayload, systemRole);

  const allPcm = Buffer.concat(result.audioChunks);
  console.log(`[S2S-Turn] Done: ${allPcm.length}B PCM transcript="${result.transcript}" aiText="${result.aiText.slice(0, 40)}"`);

  if (allPcm.length > 0) {
    const mp3 = await convertPcmToMp3InMemory(allPcm, 24000);
    return { audioBase64: mp3.toString("base64"), format: "mp3", transcript: result.transcript, aiText: result.aiText };
  }

  // Fallback: call LLM for text, then HTTP TTS
  let aiResponseText = result.aiText;
  if (!aiResponseText && result.transcript) {
    console.log(`[S2S-Turn] No aiText, calling LLM for: "${result.transcript}"`);
    aiResponseText = await callDoubaoLLM(result.transcript, systemRole);
  }
  if (!aiResponseText) {
    return { audioBase64: "", format: "mp3", transcript: result.transcript, aiText: "" };
  }
  console.log(`[S2S-Turn] HTTP TTS for: "${aiResponseText.slice(0, 60)}"`);
  const mp3 = await callDoubaoHttpTts(aiResponseText, appId, accessToken);
  return { audioBase64: mp3.toString("base64"), format: "mp3", transcript: result.transcript, aiText: aiResponseText };
}
