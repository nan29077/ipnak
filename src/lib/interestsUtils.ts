/**
 * 사용자 관심사(interests) JSON 파싱 유틸리티
 * 포맷: { methods: string[], species: string[] }
 * 구버전 flat array도 species로 간주해서 호환 처리
 */
export function parseInterests(raw: string | null): { methods: string[]; species: string[] } {
  if (!raw) return { methods: [], species: [] };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // 구버전: flat array → 모두 species로 간주
      return { methods: [], species: parsed as string[] };
    }
    return {
      methods: Array.isArray(parsed.methods) ? parsed.methods : [],
      species: Array.isArray(parsed.species) ? parsed.species : [],
    };
  } catch {
    return { methods: [], species: [] };
  }
}
