export type QualityTier = 'high' | 'medium' | 'low';

export interface QualityConfig {
  tier:            QualityTier;
  pixelRatio:      number;   // renderer DPR cap
  useFastGlass:    boolean;  // skip transmission double-pass
  bokeh:           boolean;  // include BokehPass
  bloomResScale:   number;   // 1.0 = full res, 0.5 = half
  shadowMap:       boolean;
  dustCount:       number;
  silverCount:     number;
  petalDetailMult: number;   // multiplied into flower `detail` param
}

export function detectTier(): QualityTier {
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (!isMobile) return 'high';
  const mem = (navigator as any).deviceMemory as number | undefined;
  // deviceMemory ≥ 4 GB → A15-class or better → medium; otherwise low
  return mem === undefined || mem >= 4 ? 'medium' : 'low';
}

export function buildQualityConfig(tier: QualityTier): QualityConfig {
  const dpr = window.devicePixelRatio ?? 1;
  switch (tier) {
    case 'high':
      return {
        tier,
        pixelRatio:      Math.min(dpr, 2.0),
        useFastGlass:    false,
        bokeh:           true,
        bloomResScale:   1.0,
        shadowMap:       true,
        dustCount:       600,
        silverCount:     120,
        petalDetailMult: 1.0,
      };
    case 'medium':
      return {
        tier,
        pixelRatio:      Math.min(dpr, 1.5),
        useFastGlass:    true,
        bokeh:           false,
        bloomResScale:   0.5,
        shadowMap:       false,
        dustCount:       300,
        silverCount:     60,
        petalDetailMult: 0.75,
      };
    case 'low':
      return {
        tier,
        pixelRatio:      Math.min(dpr, 1.0),
        useFastGlass:    true,
        bokeh:           false,
        bloomResScale:   0.5,
        shadowMap:       false,
        dustCount:       150,
        silverCount:     30,
        petalDetailMult: 0.5,
      };
  }
}
