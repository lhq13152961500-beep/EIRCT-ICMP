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
const FL_HAS_EVENT    = 0x4;

const EVT_START_CONN    = 1;
const EVT_FINISH_CONN   = 2;
const EVT_START_SESSION = 100;
const EVT_FINISH_SESSION = 102;
const EVT_TASK_REQUEST  = 200;
const EVT_CONN_STARTED  = 50;
const EVT_TTS_ENDED     = 359;

// Leave empty to use the dialog service's built-in default voice.
// Once voice clone data is uploaded, set this to "S_hQJPcOyZ".
export const DEFAULT_SPEAKER = "";

function int32BE(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n, 0);
  return b;
}

function lenStr(s: string): Buffer {
  const sb = Buffer.from(s, "utf-8");
  return Buffer.concat([int32BE(sb.length), sb]);
}

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

  if ((flags & 0x3) !== 0) {
    if (off + 4 <= raw.length) off += 4;
  }

  let eventId = 0;
  if (flags & 0x4) {
    if (off + 4 <= raw.length) { eventId = raw.readInt32BE(off); off += 4; }
  }

  if (eventId > 52 && eventId < 700 && off + 4 <= raw.length) {
    const sidLen = raw.readUInt32BE(off);
    if (sidLen >= 1 && sidLen <= 256 && off + 4 + sidLen <= raw.length) {
      off += 4 + sidLen;
    }
  }

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

// Doubao ARK LLM — used for HTTP TTS path when S2S LLM response is needed
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
    const text = data.choices?.[0]?.message?.content || "";
    console.log(`[DoubaoLLM] response="${text.slice(0, 60)}"`);
    return text;
  } catch (e: any) {
    console.error("[DoubaoLLM] error:", e.message);
    return "";
  }
}

// HTTP TTS — produces MP3 audio from text; two cluster fallbacks
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

async function convertPcmToMp3(pcmBuffer: Buffer, sampleRate = 24000): Promise<Buffer> {
  const id = randomUUID();
  const tmpIn  = join(tmpdir(), `dbs_pcm_${id}.pcm`);
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

export async function doublaoRealtimeTurn(req: DoubaoS2SRequest): Promise<DoubaoS2SResponse> {
  const appId       = process.env.VOLCENGINE_APP_ID;
  const accessToken = process.env.VOLCENGINE_ACCESS_TOKEN;
  if (!appId || !accessToken) throw new Error("Doubao credentials not configured");

  const tmpId  = randomUUID();
  const tmpM4a = join(tmpdir(), `dbs_in_${tmpId}.m4a`);
  const tmpPcm = join(tmpdir(), `dbs_in_${tmpId}.pcm`);

  try {
    await writeFile(tmpM4a, Buffer.from(req.audioBase64, "base64"));
    await convertM4aToPcm(tmpM4a, tmpPcm);
    const pcmData = await readFile(tmpPcm);
    console.log(`[DoubaoS2S] PCM: ${pcmData.length}B (~${(pcmData.length / 32000).toFixed(1)}s)`);

    const sessionId  = randomUUID();
    const systemRole = req.systemRole || buildSystemPrompt(req.emotion, req.location, req.activityHint, req.stepRate);

    const speakerToUse = req.speaker || DEFAULT_SPEAKER;
    const ttsConfig: Record<string, unknown> = {
      audio_config: { channel: 1, format: "pcm_s16le", sample_rate: 24000 },
    };
    if (speakerToUse) ttsConfig.speaker = speakerToUse;

    const sessionPayload = {
      asr: {
        audio_config: { format: "pcm_s16le", sample_rate: 16000, channel: 1 },
        language: "zh-CN",
      },
      tts: ttsConfig,
      dialog: {
        bot_name: "小乡",
        system_role: systemRole,
        speaking_style: "说话活泼可爱，像熟悉新疆文化的年轻导游朋友。",
      },
    };

    console.log(`[DoubaoS2S] speaker="${speakerToUse || "(default)"}"`);
    const result = await attemptS2STurn(appId, accessToken, sessionId, pcmData, sessionPayload, systemRole);

    if (result === null) throw new Error("Doubao S2S failed — check credentials and API access");

    const allPcm = Buffer.concat(result.audioChunks);
    console.log(`[DoubaoS2S] Done: ${allPcm.length}B PCM transcript="${result.transcript}" aiText="${result.aiText.slice(0, 40)}"`);

    // Path 1: S2S TTS worked — convert PCM to MP3
    if (allPcm.length > 0) {
      const mp3 = await convertPcmToMp3(allPcm, 24000);
      return { audioBase64: mp3.toString("base64"), format: "mp3", transcript: result.transcript, aiText: result.aiText };
    }

    // Path 2: S2S TTS failed (InvalidSpeaker / no audio) — use HTTP TTS
    let aiResponseText = result.aiText;

    if (!aiResponseText && result.transcript) {
      console.log(`[DoubaoS2S] No aiText, calling Doubao LLM for: "${result.transcript}"`);
      aiResponseText = await callDoubaoLLM(result.transcript, systemRole);
    }

    if (!aiResponseText) {
      // Silence — user said nothing recognisable
      return { audioBase64: "", format: "mp3", transcript: result.transcript, aiText: "" };
    }

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
  sessionPayload: object,
  systemRole: string,
): Promise<S2STurnResult | null> {
  return new Promise<S2STurnResult | null>((resolve) => {
    const ws = new WebSocket(REALTIME_WS_URL, {
      headers: {
        "X-Api-App-ID":       appId,
        "X-Api-Access-Key":   accessToken,
        "X-Api-Resource-Id":  "volc.speech.dialog",
        "X-Api-App-Key":      APP_KEY,
        "X-Api-Connect-Id":   randomUUID(),
      },
    });

    const audioChunks: Buffer[] = [];
    let transcript = "";
    let aiText     = "";
    let sessionStarted  = false;
    let settled         = false;
    let sendActive      = false;
    // Tracks whether TTS has failed so we stop waiting for audio and focus on text
    let ttsKnownFailed  = false;
    // Timer used after InvalidSpeaker: wait for LLM text (event 550) up to 5s
    let textWaitTimer: ReturnType<typeof setTimeout> | null = null;

    let seq = 0;
    const nextSeq = () => ++seq;

    function settle(result: S2STurnResult | null) {
      if (settled) return;
      settled  = true;
      sendActive = false;
      if (textWaitTimer) { clearTimeout(textWaitTimer); textWaitTimer = null; }
      clearTimeout(globalTimer);
      resolve(result);
    }

    // ── After InvalidSpeaker we keep the WS alive to receive LLM text (event 550).
    // This timer fires if LLM text still hasn't arrived after 5s — we then settle.
    function startTextWaitTimer() {
      if (textWaitTimer) return;
      textWaitTimer = setTimeout(() => {
        textWaitTimer = null;
        console.log(`[DoubaoS2S] textWait timeout — transcript="${transcript}" aiText="${aiText.slice(0, 40)}"`);
        try { ws.terminate(); } catch {}
        settle({ audioChunks: [], transcript, aiText });
      }, 5000);
    }

    const CHUNK_SIZE = 640;
    const CHUNK_MS   = 20;

    // Global safety timeout — covers connection failures, stuck sessions etc.
    // 28s: ~5s PCM stream + ~3s ASR + ~5s LLM + ~10s TTS + 5s buffer
    const globalTimer = setTimeout(() => {
      console.warn(`[DoubaoS2S] Global timeout — chunks=${audioChunks.length} transcript="${transcript}" aiText="${aiText.slice(0,40)}"`);
      try { ws.terminate(); } catch {}
      if (audioChunks.length > 0) {
        settle({ audioChunks, transcript, aiText });
      } else {
        settle({ audioChunks: [], transcript, aiText });
      }
    }, 28000);

    ws.on("open", () => {
      console.log("[DoubaoS2S] WS open → StartConnection");
      ws.send(buildConnectEvent(EVT_START_CONN, nextSeq()));
    });

    ws.on("message", (raw: Buffer) => {
      const msg = parseServerMsg(raw);

      // ── Error frame ──
      if (msg.msgType === MT_ERROR) {
        const errText = msg.errorText || "";

        if (errText.includes("InvalidSpeaker")) {
          // TTS voice unavailable — mark TTS as failed but KEEP WS alive for LLM text
          ttsKnownFailed = true;
          console.log(`[DoubaoS2S] InvalidSpeaker — keeping WS for LLM text. transcript="${transcript}" aiText="${aiText.slice(0,40)}"`);

          if (aiText) {
            // LLM already responded before the error — settle immediately
            try { ws.terminate(); } catch {}
            settle({ audioChunks: [], transcript, aiText });
          } else {
            // LLM hasn't responded yet — wait for event 550 (up to 5s)
            startTextWaitTimer();
          }
          return;
        }

        // Any other fatal error
        console.error(`[DoubaoS2S] fatal error, settling`);
        try { ws.terminate(); } catch {}
        settle({ audioChunks: [], transcript, aiText });
        return;
      }

      // ── Audio frame ──
      if (msg.msgType === MT_AUDIO_SERVER && Buffer.isBuffer(msg.payload) && (msg.payload as Buffer).length > 0) {
        if (!ttsKnownFailed) audioChunks.push(msg.payload as Buffer);
        return;
      }

      if (msg.eventId !== 0) console.log(`[DoubaoS2S] evt=${msg.eventId} type=${msg.msgType}`);

      switch (msg.eventId) {
        // ── Connection established ──
        case EVT_CONN_STARTED:
          console.log("[DoubaoS2S] Connected → StartSession");
          ws.send(buildSessionEvent(EVT_START_SESSION, nextSeq(), sessionId, sessionPayload));
          break;

        // ── Session started → stream PCM ──
        case 150:
          if (sessionStarted) break;
          sessionStarted = true;
          sendActive     = true;
          console.log("[DoubaoS2S] Session started → streaming PCM");
          streamPcm();
          break;

        // ── ASR result ──
        case 451: {
          const pl = msg.payload as Record<string, unknown>;
          const results = (pl?.results as Array<{ text: string; is_interim: boolean }>) ?? [];
          const final = results.find((r) => !r.is_interim);
          if (final?.text) { transcript = final.text; console.log("[DoubaoS2S] ASR:", transcript); }
          break;
        }

        // ── LLM streaming text ──
        case 550: {
          const pl = msg.payload as Record<string, unknown>;
          // Log raw payload to understand the actual structure
          console.log(`[DoubaoS2S] evt550 payload=${JSON.stringify(pl).slice(0, 200)}`);
          // Try multiple field paths: content / delta.content / text / reply
          let chunk = "";
          if (typeof pl?.content === "string") chunk = pl.content;
          else if (typeof (pl?.delta as Record<string, unknown>)?.content === "string")
            chunk = (pl.delta as Record<string, unknown>).content as string;
          else if (typeof pl?.text === "string") chunk = pl.text;
          else if (typeof pl?.reply === "string") chunk = pl.reply;

          if (chunk) {
            aiText += chunk;
            console.log(`[DoubaoS2S] LLM chunk="${chunk.slice(0, 60)}" total="${aiText.slice(0, 80)}"`);
            // If TTS already failed and we now have text → settle immediately
            if (ttsKnownFailed && aiText) {
              console.log(`[DoubaoS2S] Got LLM text after InvalidSpeaker → settling: "${aiText.slice(0, 60)}"`);
              if (textWaitTimer) { clearTimeout(textWaitTimer); textWaitTimer = null; }
              try { ws.terminate(); } catch {}
              settle({ audioChunks: [], transcript, aiText });
            }
          }
          break;
        }

        // ── TTS ended (success path) ──
        case EVT_TTS_ENDED:
          console.log(`[DoubaoS2S] TTSEnded — chunks=${audioChunks.length} transcript="${transcript}" aiText="${aiText}"`);
          sendActive = false;
          try {
            ws.send(buildSessionEvent(EVT_FINISH_SESSION, nextSeq(), sessionId, {}));
            ws.send(buildConnectEvent(EVT_FINISH_CONN, nextSeq()));
            ws.close();
          } catch {}
          settle({ audioChunks, transcript, aiText });
          break;

        // ── Session failed ──
        case 153:
          console.error("[DoubaoS2S] SessionFailed:", JSON.stringify(msg.payload));
          try { ws.terminate(); } catch {}
          settle({ audioChunks: [], transcript, aiText });
          break;

        // ── Connection failed ──
        case 51:
          console.error("[DoubaoS2S] ConnectFailed:", JSON.stringify(msg.payload));
          try { ws.terminate(); } catch {}
          settle(null);
          break;

        default:
          break;
      }
    });

    ws.on("error", (err) => {
      console.error("[DoubaoS2S] WS error:", err.message);
      if (!settled) settle({ audioChunks, transcript, aiText });
    });

    ws.on("close", (code) => {
      console.log(`[DoubaoS2S] WS closed code=${code}`);
      if (!settled) {
        settle(audioChunks.length > 0
          ? { audioChunks, transcript, aiText }
          : { audioChunks: [], transcript, aiText });
      }
    });

    function streamPcm() {
      let offset = 0;
      function send() {
        if (!sendActive || settled) return;
        if (offset >= pcmData.length) {
          console.log(`[DoubaoS2S] PCM done → last chunk`);
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
