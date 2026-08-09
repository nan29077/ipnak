// 입낚 불곰 캐릭터 아바타 유틸
// 사용자 ID를 seed로 캐릭터 이미지를 결정론적으로 선택 (같은 사용자는 항상 같은 이미지)
// 불곰 캐릭터 50종: /bears/ipnak_bear_01.png ~ /bears/ipnak_bear_50.png

const BEAR_CHARS = Array.from(
  { length: 50 },
  (_, i) => `/bears/ipnak_bear_${String(i + 1).padStart(2, "0")}.png`
);

export function getCharacterAvatar(userId: string): string {
  const seed = userId
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return BEAR_CHARS[seed % BEAR_CHARS.length];
}

/** avatarUrl이 있고 pravatar.cc가 아니면 그대로, 없거나 pravatar면 userId 기반 불곰 캐릭터 이미지 */
export function getAvatarUrl(userId: string, avatarUrl: string | null | undefined): string {
  if (avatarUrl && !avatarUrl.includes("pravatar.cc")) return avatarUrl;
  return getCharacterAvatar(userId);
}
