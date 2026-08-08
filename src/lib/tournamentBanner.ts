const SPECIES_BANNERS: Array<[string, string]> = [
  ["무늬오징어", "/tournaments/tournament-bear-reef-squid.jpg"],
  ["오징어", "/tournaments/tournament-bear-reef-squid.jpg"],
  ["돌돔", "/tournaments/tournament-bear-striped-beakfish.jpg"],
  ["감성돔", "/tournaments/tournament-bear-black-porgy.jpg"],
  ["광어", "/tournaments/tournament-bear-olive-flounder.jpg"],
  ["쏘가리", "/tournaments/tournament-bear-mandarin-fish.jpg"],
  ["배스", "/tournaments/tournament-bear-bass.jpg"],
];

/** 대회 어종에 맞는 입낚 불곰 마스코트 배너를 반환한다. */
export function tournamentBannerSrc(speciesName?: string | null, fallback?: string | null): string {
  const normalized = (speciesName ?? "").replace(/\s+/g, "");
  const matched = SPECIES_BANNERS.find(([species]) => normalized.includes(species));
  return matched?.[1] ?? fallback ?? "/낚시 배경 사진/불곰 캐릭터 배경 이미지/불곰 루어낚시 대회 배경이미지.png";
}
