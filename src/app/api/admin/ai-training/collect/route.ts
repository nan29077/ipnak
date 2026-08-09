import { NextResponse } from "next/server";
import {
  EMPTY_COLLECT_STATE,
  KEYWORD_PRESETS,
  KEY_COLLECT_HISTORY,
  KEY_COLLECT_STATE,
  PRESET_LABEL,
  RAW_DIR,
  type CollectHistoryItem,
  type CollectState,
  ensureTrainingDirs,
  extFromUrl,
  readJson,
  requireSuperAdmin,
  saveRawImage,
  writeJson,
} from "@/lib/aiTraining";
import { existsSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * iNaturalist 이미지 자동 수집
 *
 * POST /api/admin/ai-training/collect  { keyword, count }
 *   - 즉시 202 를 반환하고 백그라운드로 수집을 진행한다.
 *   - 진행 상황은 GET /api/admin/ai-training/collect-status 로 폴링한다.
 *
 * ⚠️ iNaturalist 사진은 관찰자마다 라이선스가 다르다(CC0 / CC-BY / All rights reserved).
 *    수집 시 라이선스 코드를 함께 기록하며, 기본값은 상업적 이용이 가능한 CC 계열만 받는다.
 */

const INAT_API = "https://api.inaturalist.org/v1/observations";
// iNaturalist 는 User-Agent 를 요구한다 (없으면 차단될 수 있음)
const UA = "IpnakTrainingCollector/1.0 (https://ipnak.kr)";
const PER_PAGE = 200;
const MAX_COUNT = 2000;
/** 다운로드 간 최소 간격(ms) — iNaturalist 서버 부하 배려 */
const DOWNLOAD_DELAY_MS = 120;
/** 재사용 가능한 라이선스만 수집 (상업적 이용 가능 + 저작자 표시) */
const ALLOWED_LICENSES = ["cc0", "cc-by", "cc-by-sa", "cc-by-nc", "cc-by-nc-sa"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setState(patch: Partial<CollectState>) {
  const cur = await readJson<CollectState>(KEY_COLLECT_STATE, EMPTY_COLLECT_STATE);
  await writeJson(KEY_COLLECT_STATE, { ...cur, ...patch, updatedAt: new Date().toISOString() });
}

/** iNaturalist 관찰 기록에서 사진 URL 목록을 뽑는다 */
async function fetchPhotoUrls(taxonName: string, need: number): Promise<{ url: string; id: string }[]> {
  const out: { url: string; id: string }[] = [];
  let page = 1;
  // iNaturalist 는 page*per_page 가 10000 을 넘으면 오류를 낸다
  const maxPage = Math.min(50, Math.ceil(need / PER_PAGE) + 3);

  while (out.length < need && page <= maxPage) {
    const params = new URLSearchParams({
      taxon_name: taxonName,
      quality_grade: "research",
      photos: "true",
      per_page: String(PER_PAGE),
      page: String(page),
      order_by: "votes",
    });
    const res = await fetch(`${INAT_API}?${params}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) break;
    const json: any = await res.json();
    const results: any[] = Array.isArray(json?.results) ? json.results : [];
    if (results.length === 0) break;

    for (const obs of results) {
      for (const photo of obs?.photos ?? []) {
        const license = String(photo?.license_code ?? "").toLowerCase();
        if (!ALLOWED_LICENSES.includes(license)) continue;
        const squareUrl: string = photo?.url ?? "";
        if (!squareUrl) continue;
        // square(75px) → medium(500px) 으로 치환해 학습에 쓸 만한 해상도를 받는다
        const url = squareUrl.replace(/\/square\.(\w+)/, "/medium.$1");
        out.push({ url, id: `${obs.id}-${photo.id}` });
        if (out.length >= need) break;
      }
      if (out.length >= need) break;
    }
    page += 1;
  }
  return out;
}

/** 실제 수집 루프 — 요청 응답과 분리해 백그라운드로 돈다 */
async function runCollect(keyword: string, taxa: string[], count: number) {
  const startedAt = new Date().toISOString();
  let saved = 0;
  let skipped = 0;
  let failed = 0;

  try {
    await ensureTrainingDirs();
    // 어종이 여러 개면 수량을 균등 배분한다
    const perTaxon = Math.max(1, Math.ceil(count / taxa.length));

    for (const taxon of taxa) {
      if (saved + skipped + failed >= count) break;
      await setState({ message: `${taxon} 검색 중…`, saved, skipped, failed });

      let photos: { url: string; id: string }[] = [];
      try {
        photos = await fetchPhotoUrls(taxon, perTaxon);
      } catch {
        failed += 1;
        continue;
      }

      for (const p of photos) {
        if (saved + skipped >= count) break;
        const fileName = `inat-${p.id}${extFromUrl(p.url)}`;
        if (existsSync(join(RAW_DIR, fileName))) {
          skipped += 1;
          continue;
        }
        try {
          const res = await fetch(p.url, { headers: { "User-Agent": UA }, cache: "no-store" });
          if (!res.ok) {
            failed += 1;
            continue;
          }
          const buf = Buffer.from(await res.arrayBuffer());
          // 1KB 미만은 깨진 이미지로 간주
          if (buf.length < 1024) {
            failed += 1;
            continue;
          }
          const ok = await saveRawImage(fileName, buf);
          if (ok) saved += 1;
          else skipped += 1;
        } catch {
          failed += 1;
        }
        if ((saved + skipped + failed) % 10 === 0) {
          await setState({ message: `${taxon} 내려받는 중…`, saved, skipped, failed });
        }
        await sleep(DOWNLOAD_DELAY_MS);
      }
    }

    const finishedAt = new Date().toISOString();
    await setState({ running: false, message: "수집 완료", saved, skipped, failed });

    const history = await readJson<CollectHistoryItem[]>(KEY_COLLECT_HISTORY, []);
    const item: CollectHistoryItem = {
      id: `${Date.now()}`,
      source: "inaturalist",
      keyword,
      requested: count,
      saved,
      skipped,
      failed,
      startedAt,
      finishedAt,
    };
    // 최근 50건만 보관
    await writeJson(KEY_COLLECT_HISTORY, [item, ...history].slice(0, 50));
  } catch (e: any) {
    await setState({
      running: false,
      message: "수집 중 오류가 발생했습니다.",
      error: String(e?.message ?? e).slice(0, 300),
      saved,
      skipped,
      failed,
    });
  }
}

export async function POST(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const preset = typeof body.preset === "string" ? body.preset : "";
  const custom = typeof body.keyword === "string" ? body.keyword.trim() : "";
  const count = Math.max(1, Math.min(MAX_COUNT, Number(body.count) || 100));

  let taxa: string[];
  let keyword: string;
  if (preset && KEYWORD_PRESETS[preset]) {
    taxa = KEYWORD_PRESETS[preset];
    keyword = PRESET_LABEL[preset] ?? preset;
  } else if (custom) {
    // 쉼표로 여러 어종 지정 가능
    taxa = custom.split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 20);
    keyword = custom;
  } else {
    return NextResponse.json({ error: "어종을 선택하거나 키워드를 입력해 주세요." }, { status: 400 });
  }
  if (taxa.length === 0) return NextResponse.json({ error: "어종 키워드가 비어 있습니다." }, { status: 400 });

  const state = await readJson<CollectState>(KEY_COLLECT_STATE, EMPTY_COLLECT_STATE);
  if (state.running) {
    return NextResponse.json({ error: "이미 수집이 진행 중입니다." }, { status: 409 });
  }

  await writeJson(KEY_COLLECT_STATE, {
    running: true,
    keyword,
    requested: count,
    saved: 0,
    skipped: 0,
    failed: 0,
    message: "수집을 시작합니다…",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies CollectState);

  // 응답을 막지 않고 백그라운드로 진행 (진행 상황은 collect-status 로 확인)
  void runCollect(keyword, taxa, count);

  return NextResponse.json({ ok: true, keyword, count }, { status: 202 });
}
