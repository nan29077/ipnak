// 측정 API 목 데이터 (서버 미구축 상태에서 UI 개발/테스트용)
const SPECIES = ['농어', '광어', '배스', '우럭', '감성돔', '붕어', '잉어']
const rnd = (a, b) => Math.round((Math.random() * (b - a) + a) * 10) / 10

const mockItems = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  measured_at: new Date(Date.now() - i * 86400000 * 2).toISOString(),
  length_cm: rnd(20, 75),
  weight_g: Math.round(rnd(200, 4000)),
  species_kr: SPECIES[i % SPECIES.length],
  confidence: rnd(0.7, 0.99),
  confidence_grade: i % 3 === 0 ? 'HIGH' : i % 3 === 1 ? 'MEDIUM' : 'LOW',
  location_name: ['인천 연안부두', '제주 서귀포항', '부산 기장군', '여수 돌산도', '강원 속초'][i % 5],
  weather: ['맑음', '흐림', '비'][i % 3],
  temperature: rnd(15, 30),
  tide_phase: i % 2 === 0 ? '만조' : '간조',
}))

export const mockAnalyze = () => ({
  lengthCm: rnd(25, 60),
  weightG: Math.round(rnd(300, 3000)),
  species: 'bass',
  confidence: 0.91,
})

export const mockHistory = (page = 1, limit = 20, species = '') => {
  const list = species ? mockItems.filter((m) => m.species_kr === species) : mockItems
  return { total: list.length, items: list.slice((page - 1) * limit, page * limit) }
}

export const mockStats = () => ({
  maxFish: mockItems[0],
  avgLength: Math.round((mockItems.reduce((s, m) => s + m.length_cm, 0) / mockItems.length) * 10) / 10,
  totalCount: mockItems.length,
  speciesBreakdown: Object.fromEntries(SPECIES.map((s) => [s, mockItems.filter((m) => m.species_kr === s).length])),
})
