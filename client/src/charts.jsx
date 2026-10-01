import { DAYS, DAYS_FULL, MON, rp } from './util';

export function DailyBars({ daily }) {
  const max = Math.max(...daily, 1), w = 300 / daily.length;
  return (
    <svg id="daily" viewBox="0 0 300 90" role="img" aria-label="Grafik batang pengeluaran harian">
      {daily.map((n, i) => {
        const h = Math.max(2, (n / max) * 74);
        return <rect key={i} x={i * w + 1.5} y={80 - h} width={w - 3} height={h} rx="2" fill={n === max && n > 0 ? 'var(--out)' : 'var(--soft-out)'} />;
      })}
      <text x="1" y="90" fontSize="7" fill="var(--muted)">1</text>
      <text x="150" y="90" fontSize="7" fill="var(--muted)" textAnchor="middle">{Math.ceil(daily.length / 2)}</text>
      <text x="299" y="90" fontSize="7" fill="var(--muted)" textAnchor="end">{daily.length}</text>
    </svg>
  );
}

export function TrendChart({ rows }) {
  const max = Math.max(...rows.flatMap((r) => [r.income, r.expense]), 1);
  const cw = 300 / rows.length;
  return (
    <svg id="trend" viewBox="0 0 300 130" role="img" aria-label="Grafik pemasukan dan pengeluaran per bulan">
      {rows.map((r, i) => {
        const x0 = i * cw + cw / 2, hi = (r.income / max) * 100, he = (r.expense / max) * 100;
        return (
          <g key={r.month}>
            <rect x={x0 - 15} y={110 - hi} width="13" height={Math.max(hi, 1)} rx="2" fill="var(--in)" />
            <rect x={x0 + 2} y={110 - he} width="13" height={Math.max(he, 1)} rx="2" fill="var(--out)" />
            <text x={x0} y="124" fontSize="9" textAnchor="middle" fill="var(--muted)" fontWeight={i === rows.length - 1 ? 700 : 400}>{MON[+r.month.slice(5) - 1]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function WeekdayChart({ avg }) {
  const mx = Math.max(...avg, 1), hi = avg.indexOf(Math.max(...avg));
  return (
    <svg viewBox="0 0 300 120" role="img" aria-label="Rata-rata pengeluaran per hari dalam seminggu">
      {avg.map((a, i) => {
        const h = Math.max(2, (a / mx) * 72), x = i * 42 + 8;
        return (
          <g key={i}>
            <rect x={x} y={98 - h} width="30" height={h} rx="5" fill={i === hi && a > 0 ? 'var(--out)' : i >= 5 ? 'var(--warn)' : 'var(--soft-out)'} />
            <text x={x + 15} y={93 - h} fontSize="8" textAnchor="middle" fill="var(--muted)">{Math.round(a / 1000)}rb</text>
            <text x={x + 15} y="112" fontSize="9" textAnchor="middle" fill="var(--muted)">{DAYS[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function PaceChart({ cum, budget, day }) {
  const n = cum.length, cur = cum[day - 1] || 0, proj = (cur / day) * n;
  const mx = Math.max(budget, proj, cum[n - 1], 1) * 1.1;
  const X = (i) => 8 + i * (284 / Math.max(n - 1, 1)), Y = (v) => 118 - (v / mx) * 108;
  const pts = cum.slice(0, day).map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  return (
    <svg id="proj" viewBox="0 0 300 140" role="img" aria-label="Grafik pengeluaran kumulatif, proyeksi, dan garis budget">
      {budget > 0 && <>
        <line x1="8" x2="292" y1={Y(budget)} y2={Y(budget)} stroke="var(--muted)" strokeDasharray="4 3" />
        <text x="8" y={Y(budget) - 4} fontSize="8" fill="var(--muted)">Budget {rp(budget / 1000)}rb</text>
      </>}
      <polyline points={pts} fill="none" stroke="var(--out)" strokeWidth="2.5" strokeLinejoin="round" />
      {day < n && <>
        <polyline points={`${X(day - 1)},${Y(cur)} ${X(n - 1)},${Y(proj)}`} fill="none" stroke="var(--warn)" strokeWidth="2" strokeDasharray="5 3" />
        <circle cx={X(n - 1)} cy={Y(proj)} r="3" fill="var(--warn)" />
      </>}
      <circle cx={X(day - 1)} cy={Y(cur)} r="3.5" fill="var(--out)" />
      <text x="8" y="134" fontSize="8" fill="var(--muted)">1</text>
      <text x="292" y="134" fontSize="8" fill="var(--muted)" textAnchor="end">{n}</text>
    </svg>
  );
}

export { DAYS_FULL };
