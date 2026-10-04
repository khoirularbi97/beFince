import { useState } from 'react';
import { api } from '../api';
import { useApi } from '../hooks';
import { PaceChart } from '../charts';
import { BudgetDialog, DepositDialog, GoalDialog } from '../dialogs';
import { Err, Loading } from '../ui';
import { curMonth, dayLabel, daysIn, jt, monthShort, monthsLeft, rp, today } from '../util';

export default function Rencana(props) {
  const [view, setView] = useState('budget');
  return (
    <div className="page" id="p-rencana">
      <div className="seg" id="rseg" role="group" aria-label="Pilih bagian">
        <button className={view === 'budget' ? 'on' : ''} onClick={() => setView('budget')}>Budget</button>
        <button className={view === 'tabungan' ? 'on' : ''} onClick={() => setView('tabungan')}>Target tabungan</button>
      </div>
      <div id="rb" hidden={view !== 'budget'}>{view === 'budget' && <BudgetSection key={props.month} {...props} />}</div>
      <div id="rt" hidden={view !== 'tabungan'}>{view === 'tabungan' && <GoalsSection {...props} />}</div>
    </div>
  );
}

/* ================= Budget ================= */
function BudgetSection({ month, ver, refresh }) {
  const bud = useApi(() => api.budgets(month), [month, ver]);
  const rep = useApi(() => api.report(month), [month, ver]);
  const [dlg, setDlg] = useState(false);
  const [sim, setSim] = useState(null);
  const items = bud.data?.items, r = rep.data;
  if (!items || !r) return <Loading err={bud.error || rep.error} />;

  const rows = items.filter((i) => i.budget > 0);
  const tb = rows.reduce((a, i) => a + i.budget, 0);
  const tu = rows.reduce((a, i) => a + i.spent, 0);
  const tp = tb ? Math.round((tu / tb) * 100) : 0;
  const over = rows.filter((i) => i.spent > i.budget).map((i) => i.name);
  const color = (p, o) => (o ? 'var(--out)' : p >= 90 ? 'var(--warn)' : 'var(--in)');

  const n = r.daily.length;
  const defDay = month === curMonth() ? Math.min(+today().slice(8), n) : month < curMonth() ? n : 1;
  const day = sim ?? defDay;
  const cum = r.daily.reduce((a, v) => (a.push((a[a.length - 1] || 0) + v), a), []);
  const cur = cum[day - 1] || 0, proj = (cur / day) * n;
  const msg = day === n
    ? `Bulan selesai. Total pengeluaran ${jt(cur)}${tb ? `, ${Math.round((cur / tb) * 100)}% dari budget.` : '.'}`
    : `Pada tanggal ${day} pengeluaran ${jt(cur)}. ${day < 10 ? 'Masih awal bulan, jadi perkiraan ini kasar karena tagihan besar biasanya masuk di awal. ' : ''}Jika laju ini berlanjut, akhir bulan sekitar ${jt(proj)}${
      !tb ? '.' : proj > tb ? `, melewati budget ${jt(proj - tb)}.` : `, masih aman dengan sisa ${jt(tb - proj)}.`}`;

  return (
    <>
      <section className="card" aria-label="Ringkasan budget">
        <div className="hd"><h2>Budget bulan ini</h2><button onClick={() => setDlg(true)}>Atur budget</button></div>
        {tb ? (
          <>
            <div className="lbl2">Terpakai {rp(tu)} dari {rp(tb)}</div>
            <div className="bar2"><i style={{ width: Math.min(tp, 100) + '%', background: color(tp, tp > 100) }} /></div>
            <p className="tip">{over.length ? `${over.length} kategori melewati budget: ${over.length > 1 ? over.slice(0, -1).join(', ') + ' dan ' + over.at(-1) : over[0]}.` : 'Semua kategori masih dalam budget.'}</p>
          </>
        ) : <p className="note">Belum ada budget yang diatur. Ketuk Atur budget untuk mulai.</p>}
      </section>

      <section className="card" aria-label="Proyeksi akhir bulan">
        <h2>Proyeksi akhir bulan</h2>
        <PaceChart cum={cum} budget={tb} day={day} />
        <div className="lg2">
          <span><i className="dot" style={{ background: 'var(--out)' }} />Pengeluaran</span>
          <span><i className="dot" style={{ background: 'var(--warn)' }} />Proyeksi</span>
          <span><i className="dot" style={{ background: 'var(--muted)' }} />Budget</span>
        </div>
        <label className="lbl2" style={{ display: 'block', marginTop: 12 }}>Simulasi: posisi tanggal <b>{day}</b>
          <input type="range" min="1" max={daysIn(month)} value={day} style={{ width: '100%', marginTop: 6 }} onChange={(e) => setSim(+e.target.value)} />
        </label>
        <p className="tip">{msg}</p>
      </section>

      <section className="card" aria-label="Budget per kategori">
        <h2>Per kategori</h2>
        {rows.length === 0 && <p className="note">Belum ada budget per kategori.</p>}
        {rows.map((i) => {
          const p = Math.round((i.spent / i.budget) * 100), o = i.spent > i.budget, c = color(p, o);
          return (
            <div className="bg" key={i.category_id}>
              <div className="bh"><b>{i.name}</b><span>{p}%</span></div>
              <div className="bar2"><i style={{ width: Math.min(p, 100) + '%', background: c }} /></div>
              <div className="bf"><span>{rp(i.spent)} dari {rp(i.budget)}</span><span style={{ color: c }}>{o ? 'Lewat ' + rp(i.spent - i.budget) : 'Sisa ' + rp(i.budget - i.spent)}</span></div>
            </div>
          );
        })}
      </section>

      <BudgetDialog open={dlg} month={month} items={items} onClose={() => setDlg(false)} onSaved={() => { setDlg(false); refresh(); }} />
    </>
  );
}

/* ================= Target tabungan ================= */
function GoalsSection({ ver, refresh, meta }) {
  const res = useApi(() => api.goals(), [ver]);
  const [form, setForm] = useState(null); // null = tertutup, { goal: null } = target baru, { goal } = ubah
  const [dep, setDep] = useState(null); // { goal, deposit }: deposit null = setoran baru
  const [hist, setHist] = useState(null); // id target yang riwayatnya terbuka
  const [pend, setPend] = useState(null);
  const [err, setErr] = useState('');
  const goals = res.data;
  if (!goals) return <Loading err={res.error} />;

  const T = goals.reduce((a, g) => a + g.target, 0), S = goals.reduce((a, g) => a + Math.min(g.saved, g.target), 0);
  const del = async (g) => {
    if (pend !== g.id) { setPend(g.id); return; }
    try { await api.delGoal(g.id); setPend(null); refresh(); } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <section className="card" aria-label="Ringkasan tabungan">
        <div className="hd"><h2>Target tabungan</h2><button onClick={() => setForm({ goal: null })}>Target baru</button></div>
        {goals.length ? (
          <>
            <div className="lbl2">Terkumpul {rp(S)} dari {rp(T)}</div>
            <div className="bar2"><i style={{ width: Math.round((S / T) * 100) + '%', background: 'var(--in)' }} /></div>
          </>
        ) : <p className="note">Belum ada target. Buat satu, misalnya dana darurat atau gadget baru.</p>}
      </section>

      {goals.length > 0 && (
        <section className="card" aria-label="Daftar target">
          {goals.map((g) => {
            const left = g.target - g.saved, done = left <= 0, pct = Math.round((g.saved / g.target) * 100);
            let hint = '';
            if (done) hint = 'Target tercapai 🎉';
            else if (g.deadline) {
              const m = monthsLeft(g.deadline);
              if (m < 1) hint = `Tenggat ${monthShort(g.deadline)} sudah lewat. Sisa ${rp(left)}.`;
              else {
                const need = Math.ceil(left / m);
                hint = `Perlu ${rp(need)} per bulan sampai ${monthShort(g.deadline)}.` +
                  (g.pace > 0 ? ` Laju 3 bulan terakhir ${rp(g.pace)} per bulan, ${g.pace >= need ? 'sudah sesuai jalur' : 'belum cukup'}.` : '');
              }
            } else hint = `Sisa ${rp(left)}.`;
            return (
              <div className="gl" key={g.id}>
                <div className="gh">
                  <div className="ic i">{g.emoji}</div>
                  <div><b>{g.name}</b><small>{g.deadline ? `Tenggat ${monthShort(g.deadline)}` : 'Tanpa tenggat'}</small></div>
                  <strong>{pct}%</strong>
                </div>
                <div className="bar2"><i style={{ width: Math.min(pct, 100) + '%', background: done ? 'var(--in)' : 'var(--w2)' }} /></div>
                <div className="gf"><span>{rp(g.saved)}</span><span>dari {rp(g.target)}</span></div>
                <p className="note">{hint}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 8 }}>
                  <button className="ghost" onClick={() => setDep({ goal: g, deposit: null })}>Setor</button>
                  <button className="ghost" onClick={() => setForm({ goal: g })}>Ubah</button>
                  <button className="ghost" aria-expanded={hist === g.id} onClick={() => setHist(hist === g.id ? null : g.id)}>Riwayat ({g.deposits})</button>
                  <button className="lnk d" onClick={() => del(g)}>{pend === g.id ? 'Yakin hapus?' : 'Hapus'}</button>
                </div>
                {hist === g.id && <DepositHistory goal={g} ver={ver} refresh={refresh} onEdit={(deposit) => setDep({ goal: g, deposit })} />}
              </div>
            );
          })}
          <Err msg={err} />
        </section>
      )}
      <p className="note">Setoran mengurangi saldo dompet yang dipilih, tapi tidak dihitung sebagai pengeluaran.</p>

      <GoalDialog open={!!form} goal={form?.goal} onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); }} />
      <DepositDialog goal={dep?.goal} deposit={dep?.deposit} wallets={meta.wallets} onClose={() => setDep(null)} onSaved={() => { setDep(null); refresh(); }} />
    </>
  );
}

/* ===== Riwayat setoran per target: lihat, ubah, hapus ===== */
function DepositHistory({ goal, ver, refresh, onEdit }) {
  const res = useApi(() => api.goalDeposits(goal.id), [goal.id, ver]);
  const [pend, setPend] = useState(null);
  const [err, setErr] = useState('');
  const rows = res.data;
  if (!rows) return <Loading err={res.error} />;
  const del = async (d) => {
    if (pend !== d.id) { setPend(d.id); return; }
    try { await api.delDeposit(goal.id, d.id); setPend(null); refresh(); } catch (e) { setErr(e.message); }
  };
  return (
    <div className="dh" aria-label={`Riwayat setoran ${goal.name}`}>
      {goal.saved_before > 0 && (
        <div className="tx"><div className="ic">🏁</div><div>Tabungan awal<small>Diubah lewat tombol Ubah di atas</small></div><strong className="in">{rp(goal.saved_before)}</strong></div>
      )}
      {rows.length === 0 && <p className="note" style={{ margin: '8px 0 0' }}>Belum ada setoran. Ketuk Setor untuk mencatat yang pertama.</p>}
      {rows.map((d) => (
        <div className="tx" key={d.id}>
          <div className="ic i">＋</div>
          <div>
            {d.wallet}
            <small>
              {dayLabel(d.date)} · {d.note}
              <button className="lnk" onClick={() => onEdit(d)}>Ubah</button>
              <button className="lnk d" onClick={() => del(d)}>{pend === d.id ? 'Yakin hapus?' : 'Hapus'}</button>
            </small>
          </div>
          <strong className="in">{rp(d.amount)}</strong>
        </div>
      ))}
      <Err msg={err} />
    </div>
  );
}
