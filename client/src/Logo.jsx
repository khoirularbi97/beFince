import { LOGO } from './logoData';

// Logo beFince sebagai SVG inline. Warna mengikuti `color` CSS (fill: currentColor), jadi otomatis cocok di mode terang/gelap.
const S = LOGO.S;
const tf = (r, x = 0, y = 0) => `translate(${x} ${y}) scale(${1 / S}) translate(0 ${r.uh}) scale(0.1 -0.1)`;

export function LogoMark({ className }) {
  const m = LOGO.mark;
  return (
    <svg className={className} viewBox={`0 0 ${m.w} ${m.h}`} role="img" aria-label="beFince" fill="currentColor">
      <g transform={tf(m)}><path d={m.d} /></g>
    </svg>
  );
}

// Tanda + wordmark berdampingan (untuk header)
export function LogoLockup({ className }) {
  const m = LOGO.mark, w = LOGO.word;
  const wh = m.h * 0.34, ws = wh / w.h, gap = m.h * 0.22;
  const total = m.w + gap + w.w * ws;
  return (
    <svg className={className} viewBox={`0 0 ${total} ${m.h}`} role="img" aria-label="beFince" fill="currentColor">
      <g transform={tf(m)}><path d={m.d} /></g>
      <g transform={`translate(${m.w + gap} ${(m.h - wh) / 2 + m.h * 0.09}) scale(${ws})`}><g transform={tf(w)}><path d={w.d} /></g></g>
    </svg>
  );
}

// Logo utama: tanda di atas, wordmark di bawah (untuk layar masuk)
export function LogoFull({ className }) {
  const s = LOGO.stack;
  return (
    <svg className={className} viewBox={`0 0 ${s.w} ${s.h}`} role="img" aria-label="beFince" fill="currentColor">
      <g transform={tf(LOGO.mark, s.mox, s.moy)}><path d={LOGO.mark.d} /></g>
      <g transform={tf(LOGO.word, s.wox, s.woy)}><path d={LOGO.word.d} /></g>
    </svg>
  );
}
