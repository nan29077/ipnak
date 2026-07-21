// 카메라 측정 모듈 — 에러 메시지/어종 상수
// (신규 모듈 전용 상수. 기존 lib/fishData.ts 와는 독립)

export const MEASURE_ERRORS = {
  BALL_NOT_FOUND: '입낚볼을 찾을 수 없어요.\n볼 전체가 화면에 보이게 다시 촬영해주세요.',
  BALL_TOO_SMALL: '볼이 너무 멀어요.\n물고기와 볼을 더 가까이서 촬영해주세요.',
  BALL_OCCLUDED: '볼이 가려진 것 같아요.\n볼 전체가 보이도록 위치를 조정해주세요.',
  BALL_LOW_CONFIDENCE: '볼 인식이 불안정해요.\n밝은 곳에서 다시 촬영해주세요.',
  FISH_NOT_FOUND: '물고기를 감지하지 못했어요.\n직접 머리와 꼬리를 탭해서 측정해주세요.',
  CAMERA_PERMISSION: '카메라 권한이 필요해요.\n설정에서 카메라 권한을 허용해주세요.',
  LOCATION_PERMISSION: '위치 권한이 없어 위치 정보를 저장하지 못했어요.',
  NETWORK_ERROR: '네트워크 오류가 발생했어요.\n로컬에 저장 후 나중에 동기화됩니다.',
  ENGINE_LOAD_FAILED: '측정 엔진을 불러오지 못했어요.\n네트워크 연결을 확인한 뒤 다시 시도해주세요.',
  SAVE_SUCCESS: '측정일지에 저장됐습니다',
}

// 어종 목록 (minLegalSize: 금지체장 cm, 0 = 제한 없음)
// 아이콘은 UI 단에서 라인형 아이콘(IconFish)으로 렌더링한다. (이모지 사용 금지 규칙)
export const FISH_SPECIES = [
  { key: '농어',   nameEn: 'bass',        minLegalSize: 30 },
  { key: '광어',   nameEn: 'flounder',    minLegalSize: 35 },
  { key: '배스',   nameEn: 'largemouth',  minLegalSize: 0  },
  { key: '우럭',   nameEn: 'rockfish',    minLegalSize: 23 },
  { key: '감성돔', nameEn: 'porgy',       minLegalSize: 25 },
  { key: '참돔',   nameEn: 'seabream',    minLegalSize: 0  },
  { key: '붕어',   nameEn: 'crucian',     minLegalSize: 0  },
  { key: '잉어',   nameEn: 'carp',        minLegalSize: 0  },
  { key: '방어',   nameEn: 'yellowtail',  minLegalSize: 0  },
  { key: '고등어', nameEn: 'mackerel',    minLegalSize: 0  },
  { key: '갈치',   nameEn: 'beltfish',    minLegalSize: 0  },
  { key: '삼치',   nameEn: 'spanish',     minLegalSize: 0  },
  { key: '기타',   nameEn: 'other',       minLegalSize: 0  },
]
