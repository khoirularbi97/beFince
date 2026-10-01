import { useEffect, useState } from 'react';
import { api } from '../api';
import { useApi } from '../hooks';
import TxList from '../TxList';
import { Err, Loading } from '../ui';
import { daysIn, rp } from '../util';

export default function Transaksi({ month, ver, meta, refresh, openTx }) {
  const bounds = () => [`${month}-01`, `${month}-${String(daysIn(month)).padStart(2, '0')}`];
  const [f, setF] = useState({ q: '', category_id: '', type: '', wallet_id: '', from: bounds()[0], to: bounds()[1] });
  const [qd, setQd] = useState('');
  const [pend, setPend] = useState(null);
  const [err, setErr] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => { const [a, b] = bounds(); setF((s) => ({ ...s, from: a, to: b })); }, [month]); // eslint-disable-line
  useEffect(() => { const t = setTimeout(() => setQd(f.q), 250); return () => clearTimeout(t); }, [f.q]);

  const res = useApi(() => api.transactions({ month, from: f.from, to: f.to, type: f.type, category_id: f.category_id, wallet_id: f.wallet_id, q: qd }),
    [month, ver, f.from, f.to, f.type, f.category_id, f.wallet_id, qd]);
  const items = res.data;
  const sum = (t) => (items || []).filter((x) => x.type === t).reduce((a, x) => a + x.amount, 0);

  const del = async (x) => {
    if (pend !== x.id) { setPend(x.id); return; }
    try { await api.delTx(x.id); setPend(null); refresh(); } catch (e) { setErr(e.message); }
  };

  return (
    <div className="page" id="p-transaksi">
      <section className="card" aria-label="Cari dan filter">
        <input type="search" placeholder="Cari catatan atau kategori" aria-label="Cari transaksi" value={f.q} onChange={(e) => set('q', e.target.value)} />
        <div className="frow">
          <select aria-label="Kategori" value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">Semua kategori</option>
            {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.type === 'income' ? ' (pemasukan)' : ''}</option>)}
          </select>
          <select aria-label="Jenis" value={f.type} onChange={(e) => set('type', e.target.value)}>
            <option value="">Semua jenis</option><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option>
          </select>
          <select aria-label="Dompet" style={{ gridColumn: '1 / -1' }} value={f.wallet_id} onChange={(e) => set('wallet_id', e.target.value)}>
            <option value="">Semua dompet</option>
            {meta.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div className="frow">
          <label>Dari<input type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></label>
          <label>Sampai<input type="date" value={f.to} onChange={(e) => set('to', e.target.value)} /></label>
        </div>
        {items && <div className="tsum">{items.length} transaksi · <span className="in">+{rp(sum('income'))}</span> · <span className="out">−{rp(sum('expense'))}</span></div>}
      </section>
      <section className="card" aria-label="Daftar transaksi">
        {!items ? <Loading err={res.error} /> : items.length === 0
          ? <p className="note">Tidak ada transaksi yang cocok. Coba ubah kata kunci atau filter.</p>
          : <TxList items={items} actions pendingId={pend} onEdit={openTx} onDelete={del} />}
        <Err msg={err} />
      </section>
    </div>
  );
}
