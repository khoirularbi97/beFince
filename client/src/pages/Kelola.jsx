import { useState } from 'react';
import { api } from '../api';
import { useApi } from '../hooks';
import { CategoryDeleteDialog, CategoryDialog, WalletDialog } from '../dialogs';
import { Err, Loading } from '../ui';
import { CAT_ICON, WALLET_HINT, WALLET_ICON, rps } from '../util';

// Kelola dompet dan kategori: tambah, ubah, hapus
export default function Kelola({ ver, refresh, onClose }) {
  const w = useApi(() => api.wallets('2099-12'), [ver]); // 2099-12 = semua transaksi, jadi saldo yang tampil adalah saldo terkini
  const c = useApi(() => api.categories(), [ver]);
  const [wd, setWd] = useState(null); // { wallet } : null = tertutup, wallet null = baru
  const [cd, setCd] = useState(null); // { category, type }
  const [del, setDel] = useState(null);
  const [pend, setPend] = useState(null);
  const [err, setErr] = useState('');
  if (!w.data || !c.data) return <div className="page" id="p-kelola"><Loading err={w.error || c.error} /></div>;

  const wallets = w.data.wallets, cats = c.data;
  const ok = () => { setWd(null); setCd(null); setDel(null); refresh(); };
  const removeWallet = async (x) => {
    if (pend !== 'w' + x.id) { setPend('w' + x.id); setErr(''); return; }
    try { await api.delWallet(x.id); setPend(null); refresh(); } catch (e) { setPend(null); setErr(e.message); }
  };
  const removeCat = async (x) => {
    setErr('');
    if (x.uses > 0) { setDel(x); return; }
    if (pend !== 'c' + x.id) { setPend('c' + x.id); return; }
    try { await api.delCategory(x.id); setPend(null); refresh(); } catch (e) { setPend(null); setErr(e.message); }
  };

  const catGroup = (type, title) => (
    <section className="card" aria-label={`Kategori ${title}`}>
      <div className="hd"><h2>Kategori {title}</h2><button onClick={() => setCd({ category: null, type })}>Tambah</button></div>
      {cats.filter((x) => x.type === type).map((x) => (
        <div className="tx" key={x.id}>
          <div className={'ic' + (type === 'income' ? ' i' : '')}>{CAT_ICON[x.name] || (type === 'income' ? '⬆️' : '🏷️')}</div>
          <div>
            {x.name}
            <small>
              {x.uses} transaksi
              <button className="lnk" onClick={() => setCd({ category: x, type })}>Ganti nama</button>
              <button className="lnk d" onClick={() => removeCat(x)}>{pend === 'c' + x.id ? 'Yakin hapus?' : 'Hapus'}</button>
            </small>
          </div>
        </div>
      ))}
    </section>
  );

  return (
    <div className="page" id="p-kelola">
      <section className="card" aria-label="Kelola dompet">
        <div className="hd"><h2>Dompet</h2><button onClick={() => setWd({ wallet: null })}>Tambah</button></div>
        {wallets.map((x) => (
          <div className="tx" key={x.id}>
            <div className="ic">{WALLET_ICON[x.kind]}</div>
            <div>
              {x.name}
              <small>
                {WALLET_HINT[x.kind]} · {x.uses} catatan
                <button className="lnk" onClick={() => setWd({ wallet: x })}>Ubah</button>
                <button className="lnk d" onClick={() => removeWallet(x)}>{pend === 'w' + x.id ? 'Yakin hapus?' : 'Hapus'}</button>
              </small>
            </div>
            <strong>{rps(x.balance)}</strong>
          </div>
        ))}
        <p className="note">Dompet yang sudah dipakai transaksi, transfer, atau setoran tidak bisa dihapus. Ubah nama atau saldo awalnya saja.</p>
      </section>
      {catGroup('expense', 'pengeluaran')}
      {catGroup('income', 'pemasukan')}
      <Err msg={err} />
      <button className="ghost" onClick={onClose}>Kembali</button>

      <WalletDialog open={!!wd} wallet={wd?.wallet} onClose={() => setWd(null)} onSaved={ok} />
      <CategoryDialog open={!!cd} category={cd?.category} type={cd?.type} onClose={() => setCd(null)} onSaved={ok} />
      <CategoryDeleteDialog category={del} categories={cats} onClose={() => setDel(null)} onSaved={ok} />
    </div>
  );
}
