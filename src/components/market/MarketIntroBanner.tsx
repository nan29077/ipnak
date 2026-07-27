type MarketIntroBannerProps = {
  variant: "shopping" | "used";
};

const CONTENT = {
  shopping: {
    eyebrow: "입낚 회원 전용 셀렉션",
    title: "낚시에 필요한 좋은 것만\n엄선해 모았어요",
    description: "회원들을 위해 꼼꼼히 고른 낚시용품을 한눈에 만나보세요.",
    image: "/market-shopping-bear-banner.png",
    accent: "bg-orange-400",
  },
  used: {
    eyebrow: "낚시인을 위한 안심 중고마켓",
    title: "회원끼리 믿고 거래하는\n중고마켓",
    description: "잘 아는 낚시인끼리 장비의 가치를 나누고 편하게 거래해요.",
    image: "/market-used-bear-banner-v2.png",
    accent: "bg-aqua-400",
  },
} as const;

export function MarketIntroBanner({ variant }: MarketIntroBannerProps) {
  const content = CONTENT[variant];

  return (
    <section className="px-4 pb-5" aria-labelledby={`${variant}-market-banner-title`}>
      <div className="relative min-h-[170px] overflow-hidden rounded-[24px] border border-white/10 bg-[#10243a] shadow-card md:min-h-[190px]">
        <img
          src={content.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#081726]/95 via-[#0a1a2a]/65 to-transparent" />

        <div className="relative z-10 flex min-h-[170px] w-[64%] flex-col justify-center px-5 py-5 md:min-h-[190px] md:px-7">
          <div className="mb-2 flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${content.accent}`} />
            <p className="text-[10px] font-bold tracking-[0.08em] text-white/70 md:text-[11px]">
              {content.eyebrow}
            </p>
          </div>
          <h1
            id={`${variant}-market-banner-title`}
            className="whitespace-pre-line text-[21px] font-extrabold leading-[1.25] tracking-[-0.03em] text-white md:text-[25px]"
          >
            {content.title}
          </h1>
          <p className="mt-2 max-w-[280px] text-[11px] leading-[1.55] text-white/65 md:text-[12px]">
            {content.description}
          </p>
        </div>
      </div>
    </section>
  );
}
