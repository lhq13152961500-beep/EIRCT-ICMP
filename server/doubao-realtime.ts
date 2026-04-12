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

const FL_SEQ_NON_TERM = 0x1;
const FL_LAST_WITH_SEQ = 0x3;
const FL_HAS_EVENT = 0x4;

const EVT_START_CONN = 1;
const EVT_FINISH_CONN = 2;
const EVT_START_SESSION = 100;
const EVT_FINISH_SESSION = 102;
const EVT_TASK_REQUEST = 200;
const EVT_CONN_STARTED = 50;
const EVT_TTS_ENDED = 359;
const EVT_DIALOG_ERROR = 599;

function int32BE(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n, 0);
  return b;
}

function lenStr(s: string): Buffer {
  const sb = Buffer.from(s, "utf-8");
  return Buffer.concat([int32BE(sb.length), sb]);
}

function buildConnectEvent(eventId: number): Buffer {
  const hdr = Buffer.from([BYTE0, (MT_FULL_CLIENT << 4) | FL_HAS_EVENT, 0x10, 0x00]);
  const pl = Buffer.from("{}");
  return Buffer.concat([hdr, int32BE(eventId), int32BE(pl.length), pl]);
}

function buildSessionEvent(eventId: number, sid: string, payload: object): Buffer {
  const hdr = Buffer.from([BYTE0, (MT_FULL_CLIENT << 4) | FL_HAS_EVENT, 0x10, 0x00]);
  const pl = Buffer.from(JSON.stringify(payload));
  return Buffer.concat([hdr, int32BE(eventId), lenStr(sid), int32BE(pl.length), pl]);
}

function buildAudioChunk(pcm: Buffer, seq: number, sid: string): Buffer {
  const flags = FL_HAS_EVENT | FL_SEQ_NON_TERM;
  const hdr = Buffer.from([BYTE0, (MT_AUDIO_CLIENT << 4) | flags, 0x00, 0x00]);
  return Buffer.concat([hdr, int32BE(seq), int32BE(EVT_TASK_REQUEST), lenStr(sid), int32BE(pcm.length), pcm]);
}

function buildLastAudioChunk(sid: string): Buffer {
  const flags = FL_HAS_EVENT | FL_LAST_WITH_SEQ;
  const hdr = Buffer.from([BYTE0, (MT_AUDIO_CLIENT << 4) | flags, 0x00, 0x00]);
  return Buffer.concat([hdr, int32BE(-1), int32BE(EVT_TASK_REQUEST), lenStr(sid), int32BE(0)]);
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

  // ── Error packet (msgType = 0xF) ──
  if (msgType === MT_ERROR) {
    let errorCode = 0;
    // Error packets always include a 4-byte code
    if (off + 4 <= raw.length) { errorCode = raw.readInt32BE(off); off += 4; }
    let plSize = 0;
    if (off + 4 <= raw.length) { plSize = raw.readUInt32BE(off); off += 4; }
    let errorText = "";
    if (plSize > 0 && off + plSize <= raw.length) {
      errorText = raw.subarray(off, off + plSize).toString("utf-8");
    }
    // If we couldn't parse a reasonable errorCode, try treating it as a direct JSON payload
    if (errorCode === 0 && raw.length > 4) {
      try {
        const rawJson = raw.subarray(4).toString("utf-8").replace(/^\0+/, "");
        const parsed = JSON.parse(rawJson);
        errorText = JSON.stringify(parsed);
      } catch {}
    }
    console.error(`[DoubaoS2S] ERROR frame: code=${errorCode} hex=${raw.toString("hex")} text=${errorText}`);
    return { msgType, eventId: 0, payload: Buffer.alloc(0), errorCode, errorText };
  }

  // ── Sequence ──
  if ((flags & 0x3) === 0x1 || (flags & 0x3) === 0x3) {
    if (off + 4 <= raw.length) off += 4;
  }

  // ── Event ID ──
  let eventId = 0;
  if (flags & 0x4) {
    if (off + 4 <= raw.length) { eventId = raw.readInt32BE(off); off += 4; }
  }

  // ── Session ID (session events, eventId > 52) ──
  if (eventId > 52 && off + 4 <= raw.length) {
    const sidLen = raw.readUInt32BE(off);
    if (sidLen >= 1 && sidLen <= 128 && off + 4 + sidLen <= raw.length) {
      off += 4 + sidLen;
    }
  }

  // ── Payload ──
  let payload: Buffer | Record<string, unknown> = Buffer.alloc(0);
  if (off + 4 <= raw.length) {
    const plSize = raw.readUInt32BE(off);
    off += 4;
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
    const systemRole =
      req.systemRole ||
      `你是「小乡」，乡音伴旅App的AI伴游导游，性格活泼热情，擅长介绍新疆文化地理美食民俗。当前用户情感：${req.emotion || "平静"}。位置：${req.location || "新疆"}。请用简短自然口语回答，每次不超过50字。`;

    // Try O2.0 first (2.2.0.0), fall back to O (1.2.1.1) on error
    const models = ["2.2.0.0", "1.2.1.1"];

    for (const model of models) {
      const sessionPayload = {
        tts: {
          speaker: "zh_female_vv_jupiter_bigtts",
          audio_config: { channel: 1, format: "pcm_s16le", sample_rate: 24000 },
        },
        dialog: {
          bot_name: "小乡",
          system_role: systemRole,
          speaking_style: "说话活泼可爱，像熟悉新疆文化的年轻导游朋友。",
          extra: {
            input_mod: "audio_file",
            model,
          },
        },
      };

      console.log(`[DoubaoS2S] Trying model=${model}`);

      const result = await attemptS2STurn(appId, accessToken, sessionId, pcmData, sessionPayload);
      if (result !== null) {
        const allPcm = Buffer.concat(result.audioChunks);
        console.log(`[DoubaoS2S] Got ${allPcm.length}B PCM with model=${model}`);
        if (allPcm.length === 0) {
          return { audioBase64: "", format: "mp3", transcript: result.transcript, aiText: "" };
        }
        const mp3 = await convertPcmToMp3(allPcm, 24000);
        return { audioBase64: mp3.toString("base64"), format: "mp3", transcript: result.transcript, aiText: result.aiText };
      }
      console.warn(`[DoubaoS2S] model=${model} failed, trying next...`);
    }

    throw new Error("All Doubao model versions failed");
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
    let seqNum = 1;
    let sendActive = false;
    let settled = false;

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
      console.warn(`[DoubaoS2S] Turn timeout`);
      ws.terminate();
      settle(audioChunks.length > 0 ? { audioChunks, transcript, aiText } : null);
    }, 25000);

    ws.on("open", () => {
      console.log("[DoubaoS2S] WS open → StartConnection");
      ws.send(buildConnectEvent(EVT_START_CONN));
    });

    ws.on("message", (raw: Buffer) => {
      const msg = parseServerMsg(raw);

      // Error frame → fail this model attempt
      if (msg.msgType === MT_ERROR) {
        ws.terminate();
        settle(null);
        return;
      }

      // Audio data → collect regardless of eventId
      if (msg.msgType === MT_AUDIO_SERVER && Buffer.isBuffer(msg.payload) && (msg.payload as Buffer).length > 0) {
        audioChunks.push(msg.payload as Buffer);
        return;
      }

      console.log(`[DoubaoS2S] evt=${msg.eventId} type=${msg.msgType}`);

      switch (msg.eventId) {
        case EVT_CONN_STARTED:
          console.log("[DoubaoS2S] Connected → StartSession");
          ws.send(buildSessionEvent(EVT_START_SESSION, sessionId, sessionPayload));
          break;

        case 150: // SessionStarted
          if (sessionStarted) break;
          sessionStarted = true;
          sendActive = true;
          console.log("[DoubaoS2S] Session started → streaming PCM");
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
          if (typeof pl?.content === "string") aiText += pl.content;
          break;
        }

        case EVT_TTS_ENDED:
          console.log(`[DoubaoS2S] TTSEnded – ${audioChunks.length} audio chunks`);
          ws.send(buildSessionEvent(EVT_FINISH_SESSION, sessionId, {}));
          ws.send(buildConnectEvent(EVT_FINISH_CONN));
          ws.close();
          settle({ audioChunks, transcript, aiText });
          break;

        case EVT_DIALOG_ERROR:
        case 153:
          console.error(`[DoubaoS2S] Dialog error evt=${msg.eventId}:`, JSON.stringify(msg.payload));
          ws.terminate();
          settle(null);
          break;

        case 51:
          console.error("[DoubaoS2S] Connection failed:", JSON.stringify(msg.payload));
          ws.terminate();
          settle(null);
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
        settle(audioChunks.length > 0 ? { audioChunks, transcript, aiText } : null);
      }
    });

    function streamPcm() {
      let offset = 0;
      function send() {
        if (!sendActive || settled) return;
        if (offset >= pcmData.length) {
          ws.send(buildLastAudioChunk(sessionId));
          return;
        }
        const end = Math.min(offset + CHUNK_SIZE, pcmData.length);
        ws.send(buildAudioChunk(pcmData.subarray(offset, end), seqNum++, sessionId));
        offset = end;
        setTimeout(send, CHUNK_MS);
      }
      send();
    }
  });
}
