import WebSocket from "ws";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const REALTIME_WS_URL = "wss://openspeech.bytedance.com/api/v3/realtime/dialogue";
const APP_KEY = "PlgvMymc7f3tQnJ6";

// Header byte 0: (proto_ver=1 << 4) | (hdr_size=1) = 0x11
// Serialization: 0=raw, 1=json
// Flags: 0x4=has_event, 0x1=seq non-terminal, 0x3=last seq
const BYTE0 = 0x11;

// Message types (high 4 bits of byte 1)
const MT_FULL_CLIENT = 0x1;
const MT_FULL_SERVER = 0x9;
const MT_AUDIO_CLIENT = 0x2;
const MT_AUDIO_SERVER = 0xb;

// Client events
const EVT_START_CONN = 1;
const EVT_FINISH_CONN = 2;
const EVT_START_SESSION = 100;
const EVT_FINISH_SESSION = 102;
const EVT_TASK_REQUEST = 200;

// Server events
const EVT_CONN_STARTED = 50;
const EVT_SESSION_STARTED = 150;
const EVT_TTS_RESPONSE = 352;
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
  const hdr = Buffer.from([BYTE0, (MT_FULL_CLIENT << 4) | 0x4, 0x10, 0x00]);
  const ev = int32BE(eventId);
  const pl = Buffer.from("{}");
  return Buffer.concat([hdr, ev, int32BE(pl.length), pl]);
}

function buildSessionEvent(eventId: number, sid: string, payload: object): Buffer {
  const hdr = Buffer.from([BYTE0, (MT_FULL_CLIENT << 4) | 0x4, 0x10, 0x00]);
  const ev = int32BE(eventId);
  const sidBuf = lenStr(sid);
  const pl = Buffer.from(JSON.stringify(payload));
  return Buffer.concat([hdr, ev, sidBuf, int32BE(pl.length), pl]);
}

function buildAudioChunk(pcm: Buffer, seq: number, sid: string, isLast: boolean): Buffer {
  const flags = isLast ? (0x4 | 0x3) : (0x4 | 0x1);
  const hdr = Buffer.from([BYTE0, (MT_AUDIO_CLIENT << 4) | flags, 0x00, 0x00]);
  const seqBuf = int32BE(isLast ? -1 : seq);
  const ev = int32BE(EVT_TASK_REQUEST);
  const sidBuf = lenStr(sid);
  return Buffer.concat([hdr, seqBuf, ev, sidBuf, int32BE(pcm.length), pcm]);
}

interface ParsedMsg {
  msgType: number;
  flags: number;
  eventId: number;
  payload: Buffer | Record<string, unknown>;
  error?: string;
}

function parseServerMsg(data: Buffer): ParsedMsg {
  let off = 0;
  const byte1 = data[1];
  const byte2 = data[2];
  const msgType = (byte1 >> 4) & 0xf;
  const flags = byte1 & 0xf;
  off = 4;

  let errorCode = 0;
  if ((flags & 0xf) === 0xf) {
    errorCode = data.readInt32BE(off);
    off += 4;
  }

  if ((flags & 0x3) === 0x1 || (flags & 0x3) === 0x3) {
    off += 4;
  }

  let eventId = 0;
  if (flags & 0x4) {
    eventId = data.readInt32BE(off);
    off += 4;
  }

  if (eventId !== 0 && eventId !== EVT_CONN_STARTED && eventId !== 51 && eventId !== 52) {
    if (off + 4 <= data.length) {
      const sidLen = data.readInt32BE(off);
      if (sidLen >= 0 && sidLen < 256 && off + 4 + sidLen <= data.length) {
        off += 4 + sidLen;
      }
    }
  }

  let payload: Buffer | Record<string, unknown> = Buffer.alloc(0);
  if (off + 4 <= data.length) {
    const plSize = data.readInt32BE(off);
    off += 4;
    if (plSize > 0 && off + plSize <= data.length) {
      const plBuf = data.subarray(off, off + plSize);
      if (msgType === MT_AUDIO_SERVER) {
        payload = plBuf;
      } else {
        try {
          payload = JSON.parse(plBuf.toString("utf-8")) as Record<string, unknown>;
        } catch {
          payload = plBuf;
        }
      }
    }
  }

  return {
    msgType,
    flags,
    eventId,
    payload,
    error: errorCode ? `error_code=${errorCode}` : undefined,
  };
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
  const tmpIn = join(tmpdir(), `doubao_pcm_${randomUUID()}.pcm`);
  const tmpOut = join(tmpdir(), `doubao_mp3_${randomUUID()}.mp3`);
  try {
    await writeFile(tmpIn, pcmBuffer);
    await new Promise<void>((resolve, reject) => {
      execFile(
        "ffmpeg",
        ["-y", "-f", "s16le", "-ar", String(sampleRate), "-ac", "1", "-i", tmpIn, tmpOut],
        (err) => (err ? reject(err) : resolve())
      );
    });
    const mp3 = await readFile(tmpOut);
    return mp3;
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
  const tmpM4a = join(tmpdir(), `doubao_in_${tmpId}.m4a`);
  const tmpPcm = join(tmpdir(), `doubao_in_${tmpId}.pcm`);

  try {
    await writeFile(tmpM4a, Buffer.from(req.audioBase64, "base64"));
    await convertM4aToPcm(tmpM4a, tmpPcm);
    const pcmData = await readFile(tmpPcm);
    const sessionId = randomUUID();

    const systemRole =
      req.systemRole ||
      `你是「小乡」，乡音伴旅App的AI伴游导游，性格活泼、热情，擅长介绍新疆文化、地理、美食和民俗。当前用户情感状态：${req.emotion || "平静"}。当前位置：${req.location || "新疆"}。请用简短自然的口语回答，每次不超过50个字。`;

    const sessionPayload = {
      tts: {
        speaker: "zh_female_vv_jupiter_bigtts",
        audio_config: {
          channel: 1,
          format: "pcm_s16le",
          sample_rate: 24000,
        },
      },
      asr: {
        audio_info: {
          format: "pcm",
          sample_rate: 16000,
          channel: 1,
        },
      },
      dialog: {
        bot_name: "小乡",
        system_role: systemRole,
        speaking_style: "你说话活泼可爱，像一个熟悉新疆文化的年轻导游朋友。",
        extra: {
          input_mod: "audio_file",
          model: "1.2.1.1",
        },
      },
    };

    const audioChunks: Buffer[] = [];
    let asrTranscript = "";
    let aiResponseText = "";

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(REALTIME_WS_URL, {
        headers: {
          "X-Api-App-ID": appId,
          "X-Api-Access-Key": accessToken,
          "X-Api-Resource-Id": "volc.speech.dialog",
          "X-Api-App-Key": APP_KEY,
          "X-Api-Connect-Id": randomUUID(),
        },
      });

      let state: "connecting" | "conn_started" | "session_started" | "streaming" | "waiting_tts" | "done" =
        "connecting";
      let seqNum = 1;
      const CHUNK_SIZE = 640;
      const CHUNK_MS = 20;

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("Doubao RealtimeAPI timeout (30s)"));
      }, 30000);

      ws.on("open", () => {
        ws.send(buildConnectEvent(EVT_START_CONN));
        state = "conn_started";
      });

      ws.on("message", async (rawData: Buffer) => {
        try {
          const msg = parseServerMsg(rawData);

          if (msg.error) {
            console.error("[Doubao] error frame:", msg.error, msg.payload);
          }

          if (msg.eventId === EVT_CONN_STARTED) {
            state = "session_started";
            ws.send(buildSessionEvent(EVT_START_SESSION, sessionId, sessionPayload));
          } else if (msg.eventId === 150) {
            state = "streaming";
            let offset = 0;
            const sendNextChunk = () => {
              if (offset >= pcmData.length) {
                state = "waiting_tts";
                ws.send(buildAudioChunk(Buffer.alloc(0), seqNum, sessionId, true));
                return;
              }
              const end = Math.min(offset + CHUNK_SIZE, pcmData.length);
              const chunk = pcmData.subarray(offset, end);
              const isLast = end >= pcmData.length;
              ws.send(buildAudioChunk(chunk, seqNum, sessionId, isLast));
              if (!isLast) {
                seqNum++;
                offset = end;
                setTimeout(sendNextChunk, CHUNK_MS);
              } else {
                state = "waiting_tts";
              }
            };
            sendNextChunk();
          } else if (msg.eventId === 451) {
            const pl = msg.payload as Record<string, unknown>;
            const results = pl?.results as Array<{ text: string; is_interim: boolean }> | undefined;
            if (results) {
              const final = results.find((r) => !r.is_interim);
              if (final) asrTranscript = final.text;
            }
          } else if (msg.eventId === 550) {
            const pl = msg.payload as Record<string, unknown>;
            if (typeof pl?.content === "string") aiResponseText += pl.content;
          } else if (msg.eventId === EVT_TTS_RESPONSE && Buffer.isBuffer(msg.payload)) {
            audioChunks.push(msg.payload as Buffer);
          } else if (msg.eventId === EVT_TTS_ENDED) {
            state = "done";
            ws.send(buildSessionEvent(EVT_FINISH_SESSION, sessionId, {}));
            ws.send(buildConnectEvent(EVT_FINISH_CONN));
            clearTimeout(timeout);
            ws.close();
            resolve();
          } else if (msg.eventId === EVT_DIALOG_ERROR) {
            const pl = msg.payload as Record<string, unknown>;
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`Doubao dialog error: ${JSON.stringify(pl)}`));
          } else if (msg.eventId === 153) {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`Doubao session failed: ${JSON.stringify(msg.payload)}`));
          } else if (msg.eventId === 51) {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`Doubao connection failed: ${JSON.stringify(msg.payload)}`));
          }
        } catch (parseErr) {
          console.error("[Doubao] parse error:", parseErr);
        }
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      ws.on("close", () => {
        if (state !== "done") {
          clearTimeout(timeout);
          if (audioChunks.length > 0) {
            resolve();
          } else {
            reject(new Error("Doubao WS closed unexpectedly"));
          }
        }
      });
    });

    const allPcm = Buffer.concat(audioChunks);
    const mp3Buffer = await convertPcmToMp3(allPcm, 24000);

    return {
      audioBase64: mp3Buffer.toString("base64"),
      format: "mp3",
      transcript: asrTranscript,
      aiText: aiResponseText,
    };
  } finally {
    unlink(tmpM4a).catch(() => {});
    unlink(tmpPcm).catch(() => {});
  }
}
