import WebSocket from "ws";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const REALTIME_WS_URL = "wss://openspeech.bytedance.com/api/v3/realtime/dialogue";
const APP_KEY = "PlgvMymc7f3tQnJ6";

const BYTE0 = 0x11;
const MT_FULL_CLIENT = 0x1;
const MT_AUDIO_CLIENT = 0x2;
const MT_AUDIO_SERVER = 0xb;
const MT_ERROR = 0xf;

// Flags
const FL_SEQ_NON_TERM = 0x1; // has sequence, not last
const FL_LAST_WITH_SEQ = 0x3; // has sequence, is last
const FL_HAS_EVENT = 0x4;

const EVT_START_CONN = 1;
const EVT_FINISH_CONN = 2;
const EVT_START_SESSION = 100;
const EVT_FINISH_SESSION = 102;
const EVT_TASK_REQUEST = 200;
const EVT_CONN_STARTED = 50;
const EVT_TTS_ENDED = 359;

// O2.0 default voice — BV700_streaming is a standard female voice available to all accounts
// BigTTS voices (zh_female_vv_jupiter_bigtts etc.) require separate activation
export const DEFAULT_SPEAKER = "BV700_streaming";

function int32BE(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n, 0);
  return b;
}

function lenStr(s: string): Buffer {
  const sb = Buffer.from(s, "utf-8");
  return Buffer.concat([int32BE(sb.length), sb]);
}

// ── All client messages MUST carry an incrementing sequence number ──
// seq=1: StartConnection
// seq=2: StartSession
// seq=3+: audio chunks
// seq=N: FinishSession / FinishConnection

function buildConnectEvent(eventId: number, seq: number): Buffer {
  const flags = FL_HAS_EVENT | FL_SEQ_NON_TERM;
  const hdr = Buffer.from([BYTE0, (MT_FULL_CLIENT << 4) | flags, 0x10, 0x00]);
  const pl = Buffer.from("{}");
  return Buffer.concat([hdr, int32BE(seq), int32BE(eventId), int32BE(pl.length), pl]);
}

function buildSessionEvent(eventId: number, seq: number, sid: string, payload: object): Buffer {
  const flags = FL_HAS_EVENT | FL_SEQ_NON_TERM;
  const hdr = Buffer.from([BYTE0, (MT_FULL_CLIENT << 4) | flags, 0x10, 0x00]);
  const pl = Buffer.from(JSON.stringify(payload));
  return Buffer.concat([hdr, int32BE(seq), int32BE(eventId), lenStr(sid), int32BE(pl.length), pl]);
}

function buildAudioChunk(pcm: Buffer, seq: number, sid: string): Buffer {
  const flags = FL_HAS_EVENT | FL_SEQ_NON_TERM;
  const hdr = Buffer.from([BYTE0, (MT_AUDIO_CLIENT << 4) | flags, 0x00, 0x00]);
  return Buffer.concat([hdr, int32BE(seq), int32BE(EVT_TASK_REQUEST), lenStr(sid), int32BE(pcm.length), pcm]);
}

function buildLastAudioChunk(seq: number, sid: string): Buffer {
  // Last chunk MUST use negative seq number (protocol requirement)
  const flags = FL_HAS_EVENT | FL_LAST_WITH_SEQ;
  const hdr = Buffer.from([BYTE0, (MT_AUDIO_CLIENT << 4) | flags, 0x00, 0x00]);
  return Buffer.concat([hdr, int32BE(-seq), int32BE(EVT_TASK_REQUEST), lenStr(sid), int32BE(0)]);
}

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
  const flags = byte1 & 0xf;
  let off = 4;

  if (msgType === MT_ERROR) {
    let errorCode = 0;
    if (off + 4 <= raw.length) { errorCode = raw.readInt32BE(off); off += 4; }
    let plSize = 0;
    if (off + 4 <= raw.length) { plSize = raw.readUInt32BE(off); off += 4; }
    let errorText = "";
    if (plSize > 0 && off + plSize <= raw.length) {
      errorText = raw.subarray(off, off + plSize).toString("utf-8");
    }
    console.error(`[DoubaoS2S] ERROR code=${errorCode} msg=${errorText || raw.toString("hex")}`);
    return { msgType, eventId: 0, payload: Buffer.alloc(0), errorCode, errorText };
  }

  // sequence (optional)
  if ((flags & 0x3) !== 0) {
    if (off + 4 <= raw.length) off += 4;
  }

  // event id (optional)
  let eventId = 0;
  if (flags & 0x4) {
    if (off + 4 <= raw.length) { eventId = raw.readInt32BE(off); off += 4; }
  }

  // session_id for session events (eventId in 100-600 range)
  if (eventId > 52 && eventId < 700 && off + 4 <= raw.length) {
    const sidLen = raw.readUInt32BE(off);
    if (sidLen >= 1 && sidLen <= 256 && off + 4 + sidLen <= raw.length) {
      off += 4 + sidLen;
    }
  }

  // payload
  let payload: Buffer | Record<string, unknown> = Buffer.alloc(0);
  if (off + 4 <= raw.length) {
    const plSize = raw.readUInt32BE(off); off += 4;
    if (plSize > 0 && off + plSize <= raw.length) {
      const plBuf = raw.subarray(off, off + plSize);
      if (msgType === MT_AUDIO_SERVER) {
        payload = plBuf;
      } else {
        try { payload = JSON.parse(plBuf.toString("utf-8")) as Record<string, unknown>; }
        catch { payload = plBuf; }
      }
    }
  }

  return { msgType, eventId, payload };
}

async function convertM4aToPcm(m4aPath: string, pcmPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    execFile(
      "ffmpeg",
      ["-y", "-i", m4aPath, "-ar", "16000", "-ac", "1", "-f", "s16le", "-acodec", "pcm_s16le", pcmPath],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

// DeepSeek LLM fallback — used when Dialog API fires InvalidSpeaker before LLM text arrives
async function callDeepSeekLLM(userText: string, systemRole: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return "";
  try {
    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "system", content: systemRole }, { role: "user", content: userText }],
        max_tokens: 100,
        temperature: 0.85,
      }),
    });
    const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content || "";
    console.log(`[DeepSeekFallback] response="${text.slice(0, 60)}"`);
    return text;
  } catch (e: any) {
    console.error("[DeepSeekFallback] error:", e.message);
    return "";
  }
}

// HTTP TTS fallback — used when Dialog API TTS returns InvalidSpeaker
async function callDoubaoHttpTts(text: string, appId: string, token: string): Promise<Buffer> {
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

async function convertPcmToMp3(pcmBuffer: Buffer, sampleRate = 24000): Promise<Buffer> {
  const id = randomUUID();
  const tmpIn = join(tmpdir(), `dbs_pcm_${id}.pcm`);
  const tmpOut = join(tmpdir(), `dbs_mp3_${id}.mp3`);
  try {
    await writeFile(tmpIn, pcmBuffer);
    await new Promise<void>((resolve, reject) => {
      execFile(
        "ffmpeg",
        ["-y", "-f", "s16le", "-ar", String(sampleRate), "-ac", "1", "-i", tmpIn, tmpOut],
        (err) => (err ? reject(err) : resolve())
      );
    });
    return await readFile(tmpOut);
  } finally {
    unlink(tmpIn).catch(() => {});
    unlink(tmpOut).catch(() => {});
  }
}

export interface DoubaoS2SRequest {
  audioBase64: string;
  mimeType?: string;
  systemRole?: string;
  emotion?: string;
  location?: string;
  speaker?: string;
}

export interface DoubaoS2SResponse {
  audioBase64: string;
  format: string;
  transcript?: string;
  aiText?: string;
}

export async function doublaoRealtimeTurn(req: DoubaoS2SRequest): Promise<DoubaoS2SResponse> {
  const appId = process.env.VOLCENGINE_APP_ID;
  const accessToken = process.env.VOLCENGINE_ACCESS_TOKEN;
  if (!appId || !accessToken) throw new Error("Doubao credentials not configured");

  const tmpId = randomUUID();
  const tmpM4a = join(tmpdir(), `dbs_in_${tmpId}.m4a`);
  const tmpPcm = join(tmpdir(), `dbs_in_${tmpId}.pcm`);

  try {
    await writeFile(tmpM4a, Buffer.from(req.audioBase64, "base64"));
    await convertM4aToPcm(tmpM4a, tmpPcm);
    const pcmData = await readFile(tmpPcm);
    console.log(`[DoubaoS2S] PCM: ${pcmData.length}B (~${(pcmData.length / 32000).toFixed(1)}s)`);

    const sessionId = randomUUID();
    const speaker = req.speaker || DEFAULT_SPEAKER;
    const systemRole =
      req.systemRole ||
      `你是「小乡」，乡音伴旅App的AI伴游导游，性格活泼热情，擅长介绍新疆文化地理美食民俗。当前用户情感：${req.emotion || "平静"}。位置：${req.location || "新疆"}。请用简短自然口语回答，每次不超过50字。`;

    // ASR config required for speech recognition; TTS uses default voice (no speaker field)
    const sessionPayload = {
      asr: {
        audio_config: { format: "pcm_s16le", sample_rate: 16000, channel: 1 },
        language: "zh-CN",
      },
      tts: {
        audio_config: { channel: 1, format: "pcm_s16le", sample_rate: 24000 },
      },
      dialog: {
        bot_name: "小乡",
        system_role: systemRole,
        speaking_style: "说话活泼可爱，像熟悉新疆文化的年轻导游朋友。",
        extra: {
          input_mod: "audio_file",
          model: "2.2.0.0",
        },
      },
    };

    console.log(`[DoubaoS2S] model=2.2.0.0 (default speaker)`);
    const result = await attemptS2STurn(appId, accessToken, sessionId, pcmData, sessionPayload);

    if (result === null) throw new Error("Doubao S2S failed — check credentials and API access");

    const allPcm = Buffer.concat(result.audioChunks);
    console.log(`[DoubaoS2S] Done: ${allPcm.length}B PCM, transcript="${result.transcript}", aiText="${result.aiText.slice(0, 40)}"`);

    // ── Path 1: S2S TTS worked ──
    if (allPcm.length > 0) {
      const mp3 = await convertPcmToMp3(allPcm, 24000);
      return { audioBase64: mp3.toString("base64"), format: "mp3", transcript: result.transcript, aiText: result.aiText };
    }

    // ── Path 2: S2S TTS failed (InvalidSpeaker) — AI text may or may not exist ──
    let aiResponseText = result.aiText;

    if (!aiResponseText && result.transcript) {
      // LLM didn't get to respond before TTS errored — call DeepSeek as fallback
      console.log(`[DoubaoS2S] No aiText, calling DeepSeek for transcript: "${result.transcript}"`);
      aiResponseText = await callDeepSeekLLM(result.transcript, systemRole);
    }

    if (!aiResponseText) {
      // Nothing to say — silence (user probably said nothing meaningful)
      return { audioBase64: "", format: "mp3", transcript: result.transcript, aiText: "" };
    }

    // Use HTTP TTS for natural Doubao female voice
    console.log(`[DoubaoS2S] HTTP TTS for: "${aiResponseText.slice(0, 60)}"`);
    const mp3 = await callDoubaoHttpTts(aiResponseText, appId, accessToken);
    return { audioBase64: mp3.toString("base64"), format: "mp3", transcript: result.transcript, aiText: aiResponseText };
  } finally {
    unlink(tmpM4a).catch(() => {});
    unlink(tmpPcm).catch(() => {});
  }
}

interface S2STurnResult {
  audioChunks: Buffer[];
  transcript: string;
  aiText: string;
}

async function attemptS2STurn(
  appId: string,
  accessToken: string,
  sessionId: string,
  pcmData: Buffer,
  sessionPayload: object
): Promise<S2STurnResult | null> {
  return new Promise<S2STurnResult | null>((resolve) => {
    const ws = new WebSocket(REALTIME_WS_URL, {
      headers: {
        "X-Api-App-ID": appId,
        "X-Api-Access-Key": accessToken,
        "X-Api-Resource-Id": "volc.speech.dialog",
        "X-Api-App-Key": APP_KEY,
        "X-Api-Connect-Id": randomUUID(),
      },
    });

    const audioChunks: Buffer[] = [];
    let transcript = "";
    let aiText = "";
    let sessionStarted = false;
    let settled = false;
    let sendActive = false;

    // Global sequence counter for ALL outgoing messages
    let seq = 0;
    const nextSeq = () => ++seq;

    function settle(result: S2STurnResult | null) {
      if (settled) return;
      settled = true;
      sendActive = false;
      clearTimeout(timer);
      resolve(result);
    }

    const CHUNK_SIZE = 640;
    const CHUNK_MS = 20;

    const timer = setTimeout(() => {
      console.warn(`[DoubaoS2S] Timeout — ${audioChunks.length} audio chunks, transcript="${transcript}", aiText="${aiText.slice(0, 40)}"`);
      ws.terminate();
      if (audioChunks.length > 0) {
        settle({ audioChunks, transcript, aiText });
      } else if (aiText || transcript) {
        // S2S got text (aiText or at least transcript) — caller will handle LLM + HTTP TTS
        console.log("[DoubaoS2S] Timeout with text — handing off to HTTP TTS pipeline");
        settle({ audioChunks: [], transcript, aiText });
      } else {
        settle(null);
      }
    }, 12000); // 12s — we know InvalidSpeaker errors come quickly

    ws.on("open", () => {
      console.log("[DoubaoS2S] WS open → StartConnection (seq=1)");
      ws.send(buildConnectEvent(EVT_START_CONN, nextSeq())); // seq=1
    });

    ws.on("message", (raw: Buffer) => {
      const msg = parseServerMsg(raw);

      if (msg.msgType === MT_ERROR) {
        const errText = msg.errorText || "";
        ws.terminate();
        if (errText.includes("InvalidSpeaker")) {
          // TTS speaker unavailable; hand off whatever text we have to HTTP TTS pipeline
          console.log(`[DoubaoS2S] InvalidSpeaker — transcript="${transcript}", aiText="${aiText.slice(0, 40)}"`);
          if (aiText || transcript) {
            settle({ audioChunks: [], transcript, aiText });
          } else {
            // Nothing yet — let timeout handle (12s is sufficient)
            console.log("[DoubaoS2S] InvalidSpeaker with no text yet — awaiting timeout");
          }
        } else {
          console.error(`[DoubaoS2S] fatal error, settling null`);
          settle(null);
        }
        return;
      }

      if (msg.msgType === MT_AUDIO_SERVER && Buffer.isBuffer(msg.payload) && (msg.payload as Buffer).length > 0) {
        audioChunks.push(msg.payload as Buffer);
        return;
      }

      console.log(`[DoubaoS2S] evt=${msg.eventId} type=${msg.msgType}`);

      switch (msg.eventId) {
        case EVT_CONN_STARTED: // 50
          console.log("[DoubaoS2S] Connected → StartSession (seq=2)");
          ws.send(buildSessionEvent(EVT_START_SESSION, nextSeq(), sessionId, sessionPayload)); // seq=2
          break;

        case 150: // SessionStarted
          if (sessionStarted) break;
          sessionStarted = true;
          sendActive = true;
          console.log("[DoubaoS2S] Session started → streaming PCM (seq starts at 3)");
          streamPcm();
          break;

        case 451: {
          const pl = msg.payload as Record<string, unknown>;
          const results = (pl?.results as Array<{ text: string; is_interim: boolean }>) ?? [];
          const final = results.find((r) => !r.is_interim);
          if (final?.text) { transcript = final.text; console.log("[S2S] ASR:", transcript); }
          break;
        }

        case 550: {
          const pl = msg.payload as Record<string, unknown>;
          if (typeof pl?.content === "string") { aiText += pl.content; }
          break;
        }

        case EVT_TTS_ENDED: // 359
          console.log(`[DoubaoS2S] TTSEnded — ${audioChunks.length} audio chunks, transcript="${transcript}" aiText="${aiText}"`);
          sendActive = false;
          ws.send(buildSessionEvent(EVT_FINISH_SESSION, nextSeq(), sessionId, {}));
          ws.send(buildConnectEvent(EVT_FINISH_CONN, nextSeq()));
          ws.close();
          settle({ audioChunks, transcript, aiText });
          break;

        case 153:
          console.error("[DoubaoS2S] SessionFailed:", JSON.stringify(msg.payload));
          ws.terminate();
          settle(null);
          break;

        case 51:
          console.error("[DoubaoS2S] ConnectFailed:", JSON.stringify(msg.payload));
          ws.terminate();
          settle(null);
          break;

        default:
          if (msg.eventId !== 0) {
            console.log(`[DoubaoS2S] unhandled evt=${msg.eventId} type=${msg.msgType}`);
          }
          break;
      }
    });

    ws.on("error", (err) => {
      console.error("[DoubaoS2S] WS error:", err.message);
      settle(null);
    });

    ws.on("close", (code) => {
      console.log(`[DoubaoS2S] WS closed code=${code}`);
      if (!settled) {
        if (audioChunks.length > 0) {
          settle({ audioChunks, transcript, aiText });
        } else if (aiText || transcript) {
          console.log("[DoubaoS2S] WS closed with text — handing off to HTTP TTS pipeline");
          settle({ audioChunks: [], transcript, aiText });
        } else {
          settle(null);
        }
      }
    });

    function streamPcm() {
      let offset = 0;
      function send() {
        if (!sendActive || settled) return;
        if (offset >= pcmData.length) {
          console.log(`[DoubaoS2S] PCM done → last chunk seq=${seq + 1}`);
          ws.send(buildLastAudioChunk(nextSeq(), sessionId));
          return;
        }
        const end = Math.min(offset + CHUNK_SIZE, pcmData.length);
        ws.send(buildAudioChunk(pcmData.subarray(offset, end), nextSeq(), sessionId));
        offset = end;
        setTimeout(send, CHUNK_MS);
      }
      send();
    }
  });
}
