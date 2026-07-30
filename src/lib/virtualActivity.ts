import "server-only";
import { prisma } from "@/lib/prisma";
import { getAiCredentials } from "@/lib/aiCredentials";
import { getSettings } from "@/lib/settings";
import { FRESH_SPECIES, LOG_CATEGORIES, MARKET_CATEGORIES, SEA_SPECIES } from "@/lib/taxonomy";
import { findPersonality, type VirtualContentArea } from "@/lib/virtualMembers";

// AI 가상회원 동적 활동 엔진.
// - 성격 유형별 프롬프트로 OpenAI(기본 gpt-4o-mini)를 호출해 글/댓글 본문을 생성한다.
// - 글은 피드·일상 피드·조행기·워킹 피드·중고마켓에 작성하고, 다른 가상회원 글에 댓글·좋아요를 남긴다.
// - 입낚볼/쇼핑 구매는 다루지 않는다(주문 데이터를 만들지 않는다).
// - 일일 최대 호출 수를 Setting 에 누적 집계하고, API 오류는 최대 3회 재시도 후 스킵한다.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MAX_RETRY = 3;
const REQUEST_TIMEOUT_MS = 20000;

const SETTING_KEYS = [
  "virtual_member_enabled",
  "virtual_member_interval_hours",
  "virtual_member_daily_limit",
  "virtual_member_model",
  "virtual_member_usage_date",
  "virtual_member_usage_count",
  "virtual_member_last_run",
] as const;

export type VirtualActivityConfig = {
  enabled: boolean;
  intervalHours: number;
  dailyLimit: number;
  model: string;
  usageDate: string;
  usageCount: number;
  lastRun: string;
};

export const DEFAULT_MODEL = "gpt-4o-mini";

/** KST 기준 오늘 날짜 (YYYY-MM-DD) — 일일 호출 한도 집계 기준 */
export function kstDateKey(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function clampInterval(v: number) {
  return Math.min(24, Math.max(1, Math.round(v) || 2));
}
export function clampDailyLimit(v: number) {
  return Math.min(2000, Math.max(0, Math.round(v) || 0));
}

export async function getVirtualActivityConfig(): Promise<VirtualActivityConfig> {
  const s = await getSettings([...SETTING_KEYS]);
  return {
    enabled: s.virtual_member_enabled === "true",
    intervalHours: clampInterval(Number(s.virtual_member_interval_hours)),
    dailyLimit: clampDailyLimit(Number(s.virtual_member_daily_limit)),
    model: s.virtual_member_model || DEFAULT_MODEL,
    usageDate: s.virtual_member_usage_date || "",
    usageCount: Number(s.virtual_member_usage_count) || 0,
    lastRun: s.virtual_member_last_run || "",
  };
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** 오늘 남은 호출 가능 횟수 */
export async function remainingQuota(config?: VirtualActivityConfig) {
  const c = config ?? (await getVirtualActivityConfig());
  const today = kstDateKey();
  const used = c.usageDate === today ? c.usageCount : 0;
  return Math.max(0, c.dailyLimit - used);
}

/** 호출 수 누적 (날짜가 바뀌면 자동으로 0부터 다시 센다) */
async function addUsage(count: number) {
  if (count <= 0) return;
  const today = kstDateKey();
  const s = await getSettings(["virtual_member_usage_date", "virtual_member_usage_count"]);
  const used = s.virtual_member_usage_date === today ? Number(s.virtual_member_usage_count) || 0 : 0;
  await setSetting("virtual_member_usage_date", today);
  await setSetting("virtual_member_usage_count", String(used + count));
}

// ===== OpenAI 호출 =====

type ChatResult = { text: string; calls: number };

/**
 * OpenAI Chat Completions 호출. 실패 시 최대 3회까지 재시도하고, 그래도 실패하면 빈 문자열을 반환한다.
 * calls 에는 실제로 발생한 호출 횟수(재시도 포함)를 담아 일일 한도 집계에 반영한다.
 */
async function callOpenAi(apiKey: string, model: string, system: string, user: string, maxTokens = 400): Promise<ChatResult> {
  let calls = 0;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    calls++;
    try {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.9,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        // 인증·요청 오류는 재시도해도 동일하므로 즉시 중단한다.
        if (res.status === 400 || res.status === 401 || res.status === 403) break;
        continue;
      }

      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? "";
      if (text.trim()) return { text: text.trim(), calls };
      lastError = "empty-response";
    } catch (e) {
      lastError = e instanceof Error ? e.message : "unknown";
    }
  }

  console.warn(`[virtual-activity] OpenAI 호출 실패 — ${MAX_RETRY}회 재시도 후 스킵 (${lastError})`);
  return { text: "", calls };
}

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    // 모델이 코드펜스를 붙이는 경우를 한 번 더 시도한다.
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]) as T; } catch { return null; }
  }
}

// ===== 프롬프트 =====

const BASE_RULES = [
  "당신은 한국 낚시 커뮤니티 앱 '입낚'의 회원입니다.",
  "실제 한국 낚시인이 쓴 것처럼 자연스러운 한국어로 씁니다.",
  "AI라는 사실을 절대 드러내지 않고, 회원 본인으로서 씁니다.",
  "실제 상호명·전화번호·계좌번호·특정 개인 이름은 쓰지 않습니다.",
  "반드시 요청받은 JSON 형식만 출력합니다. 설명이나 코드펜스는 붙이지 않습니다.",
].join(" ");

function systemPrompt(personalityKey: string, nickname: string, region: string) {
  const p = findPersonality(personalityKey);
  return [
    BASE_RULES,
    `당신의 닉네임은 '${nickname}', 주 활동 지역은 '${region}' 입니다.`,
    `성격 유형: ${p.label} — ${p.desc}.`,
    p.persona,
  ].join("\n");
}

const AREA_INSTRUCTION: Record<VirtualContentArea, { user: (ctx: PromptContext) => string; maxTokens: number }> = {
  FEED: {
    maxTokens: 300,
    user: (c) =>
      `${c.region} 지역에서 ${c.species} 낚시를 다녀온 조황 피드를 씁니다.\n` +
      `JSON 형식: {"caption": "2~4문장 캡션", "hashtags": ["해시태그", "3개"], "sizeCm": 숫자}\n` +
      `sizeCm 은 잡은 크기(cm)로 15~60 사이의 현실적인 값. 조황이 없었다면 0.`,
  },
  GENERAL: {
    maxTokens: 300,
    user: (c) =>
      `낚시 일상·장비·동출 이야기로 일상 피드 글을 씁니다. 조황 자랑이 아니어도 됩니다.\n` +
      `JSON 형식: {"caption": "2~4문장 본문", "hashtags": ["해시태그", "2~3개"]}`,
  },
  LOG: {
    maxTokens: 900,
    user: (c) =>
      `${c.region}에서 ${c.species}를 노린 조행기(게시판형 긴 글)를 씁니다. 카테고리는 '${c.logCategoryLabel}'.\n` +
      `물때·수온·채비·미끼·포인트 특징을 구체적으로 담고 2~3개 단락으로 나눕니다.\n` +
      `JSON 형식: {"title": "25자 이내 제목", "body": "400~700자 본문", "hashtags": ["해시태그", "3개"]}`,
  },
  WALKING: {
    maxTokens: 300,
    user: (c) =>
      `${c.region}을 걸어다니며 낚시한 '워킹 피드' 글을 씁니다. 이동거리와 소요시간 느낌을 담습니다.\n` +
      `JSON 형식: {"caption": "2~3문장 캡션", "distanceM": 숫자, "durationMin": 숫자, "catchCount": 숫자, "hashtags": ["해시태그", "2개"]}\n` +
      `distanceM 은 1000~9000, durationMin 은 60~360, catchCount 는 0~8 사이의 현실적인 값.`,
  },
  MARKET: {
    maxTokens: 400,
    user: (c) =>
      `쓰던 낚시 장비를 중고마켓에 판매하는 글을 씁니다. 품목 분류는 '${c.marketCategoryLabel}'.\n` +
      `JSON 형식: {"title": "30자 이내 상품명", "description": "상태·사용기간·거래방법을 담은 3~5문장", "price": 숫자, "condition": "NEW" 또는 "USED"}\n` +
      `price 는 5000~500000 사이의 1000원 단위 값.`,
  },
};

type PromptContext = {
  region: string;
  species: string;
  logCategoryLabel: string;
  marketCategoryLabel: string;
};

// ===== 보조 유틸 =====

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clampNumber(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function toHashtags(v: unknown, fallback: string[]): string {
  const arr = Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 5) : [];
  const tags = (arr.length ? arr : fallback).map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean);
  return JSON.stringify(Array.from(new Set(tags)));
}

/** 지역 문자열로 바다/민물 어종 풀을 고른다 (내륙 지역은 민물 비중을 높인다) */
function speciesFor(region: string) {
  const inland = ["충북", "세종", "대구/경북"];
  if (inland.includes(region)) return Math.random() < 0.75 ? pick(FRESH_SPECIES) : pick(SEA_SPECIES);
  if (region === "서울" || region === "경기") return Math.random() < 0.6 ? pick(FRESH_SPECIES) : pick(SEA_SPECIES);
  if (region === "제주") return pick(SEA_SPECIES);
  return Math.random() < 0.3 ? pick(FRESH_SPECIES) : pick(SEA_SPECIES);
}

/** 성격의 areaWeights 를 가중 추첨해 글 영역을 고른다 */
function pickArea(weights: Partial<Record<VirtualContentArea, number>>): VirtualContentArea {
  const entries = Object.entries(weights) as [VirtualContentArea, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [area, w] of entries) {
    r -= w;
    if (r <= 0) return area;
  }
  return entries[0][0];
}

// ===== 개별 활동 =====

type MemberWithUser = {
  id: string;
  personality: string;
  user: { id: string; nickname: string; region: string | null };
};

type ActivityLog = { kind: string; targetType: string; targetId: string | null; summary: string };

async function recordActivity(memberId: string, log: ActivityLog) {
  await prisma.virtualActivity.create({
    data: {
      memberId,
      kind: log.kind,
      targetType: log.targetType,
      targetId: log.targetId,
      summary: log.summary.slice(0, 200),
    },
  });
  await prisma.virtualMember.update({
    where: { id: memberId },
    data: { activityCount: { increment: 1 }, lastActiveAt: new Date() },
  });
}

/** 글 1건 작성. 성공하면 활동 로그를 남기고, 사용한 OpenAI 호출 수를 반환한다. */
async function writePost(
  member: MemberWithUser,
  apiKey: string,
  model: string,
): Promise<{ calls: number; created: boolean }> {
  const personality = findPersonality(member.personality);
  const area = pickArea(personality.areaWeights);
  const region = member.user.region || "경기";
  const logCategory = pick(LOG_CATEGORIES);
  const marketCategory = pick(MARKET_CATEGORIES);
  const species = speciesFor(region);

  const ctx: PromptContext = {
    region,
    species,
    logCategoryLabel: logCategory.label,
    marketCategoryLabel: marketCategory.label,
  };

  const spec = AREA_INSTRUCTION[area];
  const { text, calls } = await callOpenAi(
    apiKey,
    model,
    systemPrompt(member.personality, member.user.nickname, region),
    spec.user(ctx),
    spec.maxTokens,
  );
  if (!text) return { calls, created: false };

  const data = parseJson<Record<string, unknown>>(text);
  if (!data) return { calls, created: false };

  const authorId = member.user.id;

  if (area === "MARKET") {
    const title = String(data.title || "").trim().slice(0, 60);
    const description = String(data.description || "").trim();
    if (!title || !description) return { calls, created: false };
    const price = Math.round(clampNumber(data.price, 5000, 500000, 30000) / 1000) * 1000;
    const listing = await prisma.marketListing.create({
      data: {
        sellerId: authorId,
        title,
        category: marketCategory.key,
        condition: data.condition === "NEW" ? "NEW" : "USED",
        price,
        region,
        description,
        tradeMethod: pick(["DIRECT", "DELIVERY", "BOTH"]),
        status: "SELLING",
      },
    });
    await recordActivity(member.id, { kind: "MARKET", targetType: "MARKET_LISTING", targetId: listing.id, summary: title });
    return { calls, created: true };
  }

  if (area === "LOG") {
    const title = String(data.title || "").trim().slice(0, 80);
    const body = String(data.body || "").trim();
    if (!title || !body) return { calls, created: false };
    const post = await prisma.post.create({
      data: {
        authorId,
        kind: "LOG",
        postType: "GENERAL",
        title,
        body,
        boardCategory: logCategory.key,
        region,
        speciesName: species,
        visibility: "PUBLIC",
        hashtags: toHashtags(data.hashtags, ["조행기", region, species]),
      },
    });
    await recordActivity(member.id, { kind: "LOG", targetType: "POST", targetId: post.id, summary: title });
    return { calls, created: true };
  }

  const caption = String(data.caption || "").trim();
  if (!caption) return { calls, created: false };

  if (area === "WALKING") {
    const distanceM = clampNumber(data.distanceM, 500, 12000, 3000);
    const durationSec = clampNumber(data.durationMin, 20, 480, 120) * 60;
    const catchCount = clampNumber(data.catchCount, 0, 12, 1);
    const post = await prisma.post.create({
      data: {
        authorId,
        kind: "WALKING",
        postType: "WALKING_FEED",
        caption,
        // 워킹 피드 카드가 파싱하는 통계 JSON — 동선(route)은 생성하지 않는다.
        body: JSON.stringify({ routePoints: [], distanceM, durationSec, points: 0, catchCount, catchMarkers: [] }),
        region,
        speciesName: catchCount > 0 ? species : null,
        visibility: "PUBLIC",
        hashtags: toHashtags(data.hashtags, ["워킹낚시", region]),
      },
    });
    await recordActivity(member.id, { kind: "WALKING", targetType: "POST", targetId: post.id, summary: caption });
    return { calls, created: true };
  }

  // FEED(피싱 피드) / GENERAL(일상 피드) — 피싱 피드만 어종·크기를 붙인다.
  const isFishing = area === "FEED";
  const sizeCm = isFishing ? clampNumber(data.sizeCm, 0, 120, 0) : 0;
  const post = await prisma.post.create({
    data: {
      authorId,
      kind: "FEED",
      postType: "GENERAL",
      caption,
      region,
      speciesName: isFishing ? species : null,
      sizeCm: isFishing && sizeCm > 0 ? sizeCm : null,
      visibility: "PUBLIC",
      hashtags: toHashtags(data.hashtags, isFishing ? [region, species] : ["낚시일상", region]),
    },
  });
  await recordActivity(member.id, { kind: isFishing ? "FEED" : "GENERAL", targetType: "POST", targetId: post.id, summary: caption });
  return { calls, created: true };
}

/** 다른 가상회원 글에 댓글 1건 작성 */
async function writeComment(
  member: MemberWithUser,
  apiKey: string,
  model: string,
  candidateIds: string[],
): Promise<{ calls: number; created: boolean }> {
  const pool = candidateIds.filter((id) => id !== member.user.id);
  if (pool.length === 0) return { calls: 0, created: false };

  // 최근 글 중 자기 글이 아닌 것 하나를 고른다.
  const post = await prisma.post.findFirst({
    where: { authorId: { in: pool }, hidden: false, visibility: "PUBLIC" },
    orderBy: { createdAt: "desc" },
    skip: Math.floor(Math.random() * 20),
    select: { id: true, title: true, caption: true, body: true, kind: true },
  });
  if (!post) return { calls: 0, created: false };

  const excerpt = (post.kind === "LOG" ? `${post.title ?? ""}\n${post.body ?? ""}` : post.caption ?? "").slice(0, 500);
  if (!excerpt.trim()) return { calls: 0, created: false };

  const { text, calls } = await callOpenAi(
    apiKey,
    model,
    systemPrompt(member.personality, member.user.nickname, member.user.region || "경기"),
    `다음 회원 글에 남길 댓글을 씁니다. 1~2문장으로 짧게, 성격 유형에 맞는 말투로 씁니다.\n` +
      `JSON 형식: {"comment": "댓글 내용"}\n\n글 내용:\n${excerpt}`,
    150,
  );
  if (!text) return { calls, created: false };

  const data = parseJson<{ comment?: unknown }>(text);
  const body = String(data?.comment || "").trim();
  if (!body) return { calls, created: false };

  const comment = await prisma.comment.create({
    data: { postId: post.id, authorId: member.user.id, body: body.slice(0, 500) },
  });
  await recordActivity(member.id, { kind: "COMMENT", targetType: "COMMENT", targetId: comment.id, summary: body });
  return { calls, created: true };
}

/** 다른 가상회원 글에 좋아요 (OpenAI 호출 없음) */
async function pressLike(member: MemberWithUser, candidateIds: string[]): Promise<boolean> {
  const pool = candidateIds.filter((id) => id !== member.user.id);
  if (pool.length === 0) return false;

  const post = await prisma.post.findFirst({
    where: {
      authorId: { in: pool },
      hidden: false,
      visibility: "PUBLIC",
      likes: { none: { userId: member.user.id } },
    },
    orderBy: { createdAt: "desc" },
    skip: Math.floor(Math.random() * 30),
    select: { id: true, caption: true, title: true },
  });
  if (!post) return false;

  const like = await prisma.like
    .create({ data: { postId: post.id, userId: member.user.id } })
    .catch(() => null);
  if (!like) return false;

  await recordActivity(member.id, {
    kind: "LIKE",
    targetType: "LIKE",
    targetId: post.id,
    summary: (post.title || post.caption || "").slice(0, 100),
  });
  return true;
}

// ===== 활동 사이클 =====

export type RunResult = {
  ok: boolean;
  reason?: "disabled" | "no-key" | "no-members" | "quota-exhausted";
  posts: number;
  comments: number;
  likes: number;
  calls: number;
  remaining: number;
};

/**
 * 활동 사이클 1회 실행.
 * 활성 가상회원 중 일부를 성격 유형 확률에 따라 뽑아 글·댓글·좋아요를 만든다.
 * 남은 일일 호출 한도를 넘지 않도록 매 활동마다 잔량을 확인한다.
 *
 * @param force true 면 전체 on/off 스위치가 꺼져 있어도 실행한다(관리자 "지금 실행" 버튼용).
 */
export async function runVirtualActivityCycle(options?: { force?: boolean; maxMembers?: number }): Promise<RunResult> {
  const config = await getVirtualActivityConfig();
  const empty = { posts: 0, comments: 0, likes: 0, calls: 0 };

  if (!config.enabled && !options?.force) {
    return { ok: false, reason: "disabled", ...empty, remaining: await remainingQuota(config) };
  }

  const { openai: apiKey } = await getAiCredentials();
  if (!apiKey) return { ok: false, reason: "no-key", ...empty, remaining: await remainingQuota(config) };

  let quota = await remainingQuota(config);
  if (quota <= 0) return { ok: false, reason: "quota-exhausted", ...empty, remaining: 0 };

  const members = await prisma.virtualMember.findMany({
    where: { active: true },
    include: { user: { select: { id: true, nickname: true, region: true } } },
  });
  if (members.length === 0) {
    return { ok: false, reason: "no-members", ...empty, remaining: quota };
  }

  const candidateIds = members.map((m) => m.user.id);

  // 한 사이클에 움직이는 인원 — 한도를 한 번에 소진하지 않도록 기본 12명으로 제한한다.
  const maxMembers = Math.max(1, Math.min(options?.maxMembers ?? 12, members.length));
  const shuffled = [...members].sort(() => Math.random() - 0.5).slice(0, maxMembers);

  let posts = 0, comments = 0, likes = 0, calls = 0;

  for (const member of shuffled) {
    if (quota <= 0) break;
    const personality = findPersonality(member.personality);

    // 좋아요는 OpenAI 호출이 없어 한도와 무관하게 자연스러운 반응으로 섞는다.
    if (Math.random() < 0.6 && (await pressLike(member, candidateIds))) likes++;

    if (Math.random() < personality.postRate) {
      const r = await writePost(member, apiKey, config.model);
      calls += r.calls;
      quota -= r.calls;
      if (r.created) posts++;
    } else {
      const r = await writeComment(member, apiKey, config.model, candidateIds);
      calls += r.calls;
      quota -= r.calls;
      if (r.created) comments++;
    }
  }

  await addUsage(calls);
  await setSetting("virtual_member_last_run", new Date().toISOString());

  return { ok: true, posts, comments, likes, calls, remaining: Math.max(0, quota) };
}
