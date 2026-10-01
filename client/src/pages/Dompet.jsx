import { useState } from 'react';
import { api } from '../api';
import { useApi } from '../hooks';
import { TransferDialog } from '../dialogs';
import { Err, Loading, tilt } from '../ui';
import { WALLET_HINT, WALLET_ICON, WALLET_VAR, dayLabel, rp, rps } from '../util';

export default function Dompet({ month, ver, refresh }) {
  const res = useApi(() => api.wallets(month), [month, ver]);
  const [dlg, setDlg] = useState(false);
  const [pend, setPend] = useState(null);
  const [err, setErr] = useState('');
  const d = res.data;
  if (!d) return <Loading err={res.error} />;

  const name = (id) => d.wallets.find((w) => w.id === id)?.name || 'Dompet';
  const spent = d.wallets.reduce((a, w) => a + w.expense, 0);
  const t = d.totals;
  const del = async (x) => {
    if (pend !== x.id) { setPend(x.id); return; }
    try { await api.delTransfer(x.id); setPend(null); refresh(); } catch (e) { setErr(e.message); }
  };

  return (
    <div className="page" id="p-dompet">
      <section className="card hero" aria-label="Total saldo" {...tilt}>
        <div className="lbl">Total saldo semua dompet</div>
        <div className="big">{rps(t.balance)}</div>
        <p className="tip" style={{ marginTop: 6 }}>
          Bulan ini {t.net >= 0 ? 'naik' : 'turun'} {rp(Math.abs(t.net))}
          {t.saved > 0 ? `, setelah menyetor ${rp(t.saved)} ke tabungan` : ''}.
        </p>
      </section>

      <div className="wscroll" aria-label="Daftar dompet">
        {d.wallets.map((w) => (
          <div className="wc" key={w.id} style={{ '--wc': `var(${WALLET_VAR[w.kind]})` }} {...tilt}>
            <div className="wc-top">
              <span className="wc-ic">{WALLET_ICON[w.kind]}</span>
              <span><b>{w.name}</b><small>{WALLET_HINT[w.kind]}</small></span>
            </div>
            <div className="wc-bal">{rps(w.balance)}</div>
            <div className="wc-row"><span>Masuk<b>+{rp(w.income)}</b></span><span>Keluar<b>−{rp(w.expense)}</b></span></div>
          </div>
        ))}
      </div>

      <section className="card" aria-label="Pengeluaran per dompet">
        <h2>Pengeluaran dari mana</h2>
        <div className="wsplit" role="img" aria-label="Pembagian pengeluaran per dompet">
          {d.wallets.map((w) => <i key={w.id} style={{ flex: Math.max(w.expense, 1), background: `var(${WALLET_VAR[w.kind]})` }} />)}
        </div>
        <div className="wcap">
          {d.wallets.map((w) => (
            <div className="wl" key={w.id}>
              <span><i className="dot" style={{ background: `var(${WALLET_VAR[w.kind]})` }} />{w.name}</span>
              <b>{rp(w.expense)}</b>
              <span className="pc">{spent ? Math.round((w.expense / spent) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card" aria-label="Transfer antar dompet">
        <div className="hd"><h2>Transfer antar dompet</h2><button className="ghost" onClick={() => setDlg(true)}>Transfer</button></div>
        {d.transfers.length === 0 && <p className="note">Belum ada transfer bulan ini.</p>}
        {d.transfers.map((x) => (
          <div className="tx" key={x.id}>
            <div className="ic">⇄</div>
            <div>
              {name(x.from_wallet)} → {name(x.to_wallet)}
              <small>{dayLabel(x.date)} · {x.note} · <button className="lnk d" onClick={() => del(x)}>{pend === x.id ? 'Yakin hapus?' : 'Hapus'}</button></small>
            </div>
            <strong>{rp(x.amount)}</strong>
          </div>
        ))}
        <p className="note">Transfer hanya memindahkan saldo, tidak dihitung sebagai pemasukan atau pengeluaran.</p>
        <Err msg={err} />
      </section>

      <TransferDialog open={dlg} wallets={d.wallets} month={month} onClose={() => setDlg(false)} onSaved={() => { setDlg(false); refresh(); }} />
    </div>
  );
}
