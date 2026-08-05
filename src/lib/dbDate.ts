/** MariaDB DATETIME에 안전하게 바인딩할 수 있는 날짜 문자열로 변환.
 * MariaDB는 "2024-01-15T09:30:00.000Z" 같은 ISO 문자열을 DATETIME에 바인딩하면
 * Error 1292 (Incorrect datetime value)가 발생한다. "YYYY-MM-DD HH:MM:SS" 형식은 안전하다. */
export function toDbDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** 개발(SQLite) 환경 여부 — 일부 raw SQL은 SQLite/MariaDB 저장 방식이 달라 분기가 필요하다 */
export function isSqliteDb(): boolean {
  return (process.env.DATABASE_URL ?? "").startsWith("file:");
}
