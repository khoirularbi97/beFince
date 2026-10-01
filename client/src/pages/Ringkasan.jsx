import { useState } from 'react';
import { api, download } from '../api';
import { useApi } from '../hooks';
import { DailyBars } from '../charts';
import TxList from '../TxList';
import { Err, Loading, tilt } from '../ui';
import { rp } from '../util';

export default function Ringkasan({ month, ver, setTab }) {
  const rep = useApi(() => api.report(month), [month, ver]);
  const recent = useApi(() => api.transactions({ month, limit: 5 }), [month, ver]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const r = rep.data;
  if (!r) return <Loading err={rep.error} />;

  const used = r.income ? Math.round((r.expense / r.income) * 100) : 0;
  const diff = r.prevExpense ? Math.round(((r.expense - r.prevExpense) / r.prevExpense) * 100) : null;
  const tip = [
    r.income ? `${used}% pemasukan sudah terpakai.` : 'Belum ada pemasukan bulan ini.',
    diff === null ? '' : diff === 0 ? 'Pengeluaran sama dengan bulan lalu.'
      : `Pengeluaran ${Math.abs(diff)}% ${diff < 0 ? 'lebih rendah' : 'lebih tinggi'} dari bulan lalu.`,
  ].join(' ');
  const max = r.byCategory[0]?.total || 1;
  const top = r.byCategory[0];
  const peak = Math.max(...r.daily);
  const peakDay = r.daily.indexOf(peak) + 1;

  const exp = async (kind) => {
    setBusy(kind); setErr('');
    try { await download(`/api/export/${kind}?month=${month}`, `laporan-${month}.${kind}`); }
    catch (e) { setErr(e.message); }
    setBusy('');
  };

  return (
    <div className="page" id="p-ringkasan">
      <section className="card hero" aria-label="Ringkasan bulan ini" {...tilt}>
        <div className="lbl">Sisa uang bulan ini</div>
        <div className="big">{rp(r.balance)}</div>
        <div className="split" role="img" aria-label={`${used}% pemasukan sudah terpakai`}><i style={{ width: Math.min(used, 100) + '%' }} /></div>
        <div className="legend">
          <div><span className="out">Pengeluaran</span><b>{rp(r.expense)}</b></div>
          <div style={{ textAlign: 'right' }}><span className="in">Pemasukan</span><b>{rp(r.income)}</b></div>
        </div>
        <p className="tip">{tip}</p>
      </section>

      {r.byCategory.length > 0 ? (
        <>
          <section className="card" aria-label="Pengeluaran per kategori">
            <h2>Ke mana uangnya pergi</h2>
            {r.byCategory.map((c) => (
              <div className="cat" key={c.name}>
                <span>{c.name}</span>
                <div className="bar"><i style={{ width: (c.total / max) * 100 + '%' }} /></div>
                <span>{rp(c.total)}</span>
              </div>
            ))}
            <p className="note">{top.name} menyumbang {Math.round((top.total / r.expense) * 100)}% dari total pengeluaran.</p>
          </section>
          <section className="card daily" aria-label="Pengeluaran harian">
            <h2>Pengeluaran per hari</h2>
            <DailyBars daily={r.daily} />
            <p className="note">Tanggal {peakDay} paling boros: {rp(peak)}.</p>
          </section>
        </>
      ) : (
        <section className="card"><h2>Belum ada pengeluaran</h2><p className="note">Ketuk "Catat transaksi" untuk mencatat yang pertama di bulan ini.</p></section>
      )}

      <section className="card" aria-label="Transaksi terbaru">
        <h2>Transaksi terbaru</h2>
        {recent.data ? <TxList items={recent.data} /> : <Loading err={recent.error} />}
        {recent.data?.length === 0 && <p className="note">Belum ada transaksi.</p>}
        <button className="ghost" style={{ marginTop: 10, width: '100%' }} onClick={() => setTab('transaksi')}>Lihat semua transaksi</button>
      </section>

      <section className="card" aria-label="Ekspor laporan">
        <h2>Ekspor laporan bulan ini</h2>
        <div className="frow" style={{ marginTop: 0 }}>
          <button className="ghost" disabled={!!busy} onClick={() => exp('pdf')}>{busy === 'pdf' ? 'Membuat…' : 'Unduh PDF'}</button>
          <button className="ghost" disabled={!!busy} onClick={() => exp('csv')}>{busy === 'csv' ? 'Membuat…' : 'Unduh CSV'}</button>
        </div>
        <p className="note">PDF berisi ringkasan, budget, saldo dompet, dan target tabungan. CSV berisi semua transaksi bulan ini, dengan pemisah titik koma (rapi di Excel pengaturan Indonesia dan Google Sheets).</p>
        <Err msg={err} />
      </section>
    </div>
  );
}
