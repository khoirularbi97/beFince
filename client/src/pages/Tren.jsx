import { api } from '../api';
import { useApi } from '../hooks';
import { TrendChart, WeekdayChart, DAYS_FULL } from '../charts';
import { Loading } from '../ui';
import { jt, rp } from '../util';

const sum = (a, from, to) => a.slice(from, to).reduce((x, y) => x + y, 0);

export default function Tren({ month, ver }) {
  const trend = useApi(() => api.trend(month, 6), [month, ver]);
  const rep = useApi(() => api.report(month), [month, ver]);
  const wk = useApi(() => api.weekday(month), [month, ver]);

  return (
    <div className="page" id="p-tren">
      <section className="card" aria-label="Tren 6 bulan">
        <h2>Pemasukan dan pengeluaran 6 bulan</h2>
        {!trend.data ? <Loading err={trend.error} /> : <TrendBlock rows={trend.data} />}
      </section>

      <section className="card" aria-label="Pola mingguan">
        <h2>Pola pengeluaran per hari dalam seminggu</h2>
        {!wk.data ? <Loading err={wk.error} /> : <WeekBlock d={wk.data} />}
      </section>

      <section className="card" aria-label="Perubahan per kategori">
        <h2>Perubahan per kategori</h2>
        {!rep.data ? <Loading err={rep.error} /> : <ChangeTable rep={rep.data} />}
      </section>
    </div>
  );
}

function TrendBlock({ rows }) {
  const left = rows.map((r) => r.income - r.expense);
  const cur = left[left.length - 1];
  const avgExp = rows.reduce((a, r) => a + r.expense, 0) / rows.length;
  const best = cur > 0 && cur === Math.max(...left);
  return (
    <>
      <TrendChart rows={rows} />
      <div className="lg2"><span><i className="dot" style={{ background: 'var(--in)' }} />Pemasukan</span><span><i className="dot" style={{ background: 'var(--out)' }} />Pengeluaran</span></div>
      <p className="tip">
        Sisa uang bulan ini {jt(cur)}{best ? ', paling besar dalam 6 bulan terakhir' : ''}. Rata-rata pengeluaran {jt(avgExp)} per bulan.
      </p>
    </>
  );
}

function WeekBlock({ d }) {
  const wdDays = sum(d.days, 0, 5), weDays = sum(d.days, 5, 7);
  if (!wdDays && !weDays) return <p className="note">Belum ada data hari untuk bulan ini.</p>;
  const wd = wdDays ? sum(d.total, 0, 5) / wdDays : 0;
  const we = weDays ? sum(d.total, 5, 7) / weDays : 0;
  const hi = d.avg.indexOf(Math.max(...d.avg));
  const pct = wd ? Math.round(((we - wd) / wd) * 100) : null;
  return (
    <>
      <WeekdayChart avg={d.avg} />
      <div className="lg2"><span><i className="dot" style={{ background: 'var(--out)' }} />Paling boros</span><span><i className="dot" style={{ background: 'var(--warn)' }} />Akhir pekan</span></div>
      <p className="tip">
        {pct === null ? `Rata-rata akhir pekan ${rp(we)} per hari.`
          : `Rata-rata akhir pekan ${rp(we)} per hari, ${Math.abs(pct)}% ${pct >= 0 ? 'lebih tinggi' : 'lebih rendah'} dibanding hari kerja (${rp(wd)}).`}
        {d.avg[hi] > 0 && ` Hari paling boros: ${DAYS_FULL[hi]}.`}
      </p>
      <p className="note">Angka adalah rata-rata per hari, jadi bulan dengan lebih banyak hari tertentu tidak menyesatkan.</p>
    </>
  );
}

function ChangeTable({ rep }) {
  const prev = Object.fromEntries(rep.prevByCategory.map((c) => [c.name, c.total]));
  const cur = Object.fromEntries(rep.byCategory.map((c) => [c.name, c.total]));
  const names = [...new Set([...Object.keys(cur), ...Object.keys(prev)])].sort((a, b) => (cur[b] || 0) - (cur[a] || 0));
  if (!names.length) return <p className="note">Belum ada pengeluaran untuk dibandingkan.</p>;
  return (
    <>
      <div className="cr h"><span>Kategori</span><span>Bulan lalu</span><span>Bulan ini</span><span>Selisih</span></div>
      {names.map((n) => {
        const p = prev[n] || 0, c = cur[n] || 0;
        const d = p ? Math.round(((c - p) / p) * 100) : null;
        return (
          <div className="cr" key={n}>
            <span>{n}</span><span>{jt(p)}</span><span>{jt(c)}</span>
            <span className={d === null || d === 0 ? '' : d > 0 ? 'out' : 'in'}>{d === null ? 'baru' : `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}%`}</span>
          </div>
        );
      })}
    </>
  );
}
