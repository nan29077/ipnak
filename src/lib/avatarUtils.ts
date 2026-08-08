// 캐릭터 스티커 이미지 아바타 유틸
// 사용자 ID를 seed로 캐릭터 이미지를 결정론적으로 선택 (같은 사용자는 항상 같은 이미지)

const MALE_CHARS = Array.from(
  { length: 13 },
  (_, i) =>
    `/%EC%BA%90%EB%A6%AD%ED%84%B0%20%EC%8A%A4%ED%8B%B0%EC%BB%A4%20%EC%9D%B4%EB%AF%B8%EC%A7%80/%EB%82%A8%EC%84%B1%20%EA%B5%AC%EB%A7%A4%ED%9A%8C%EC%9B%90/%EB%82%A8%EC%84%B1%20%EA%B5%AC%EB%A7%A4%ED%9A%8C%EC%9B%90${i + 1}.png`
);
const FEMALE_CHARS = Array.from(
  { length: 13 },
  (_, i) =>
    `/%EC%BA%90%EB%A6%AD%ED%84%B0%20%EC%8A%A4%ED%8B%B0%EC%BB%A4%20%EC%9D%B4%EB%AF%B8%EC%A7%80/%EC%97%AC%EC%84%B1%20%EA%B5%AC%EB%A7%A4%ED%9A%8C%EC%9B%90/%EC%97%AC%EC%84%B1%20%EA%B5%AC%EB%A7%A4%ED%9A%8C%EC%9B%90${i + 1}.png`
);
const ALL_CHARS = [...MALE_CHARS, ...FEMALE_CHARS]; // 26개

export function getCharacterAvatar(userId: string): string {
  const seed = userId
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return ALL_CHARS[seed % ALL_CHARS.length];
}

/** avatarUrl이 있고 pravatar.cc가 아니면 그대로, 없거나 pravatar면 userId 기반 캐릭터 이미지 */
export function getAvatarUrl(userId: string, avatarUrl: string | null | undefined): string {
  if (avatarUrl && !avatarUrl.includes("pravatar.cc")) return avatarUrl;
  return getCharacterAvatar(userId);
}
