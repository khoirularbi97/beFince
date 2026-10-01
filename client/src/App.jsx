import { useEffect, useState } from 'react';
import { api, auth, setUnauthorizedHandler } from './api';
import { useApi } from './hooks';
import { PasswordDialog, TxDialog } from './dialogs';
import { LogoLockup } from './Logo';
import { Dialog, Loading } from './ui';
import AuthScreen from './Auth';
import { curMonth, monthLabel, shiftMonth } from './util';
import Ringkasan from './pages/Ringkasan';
import Transaksi from './pages/Transaksi';
import Dompet from './pages/Dompet';
import Tren from './pages/Tren';
import Rencana from './pages/Rencana';

const TABS = [['ringkasan', 'Ringkasan', Ringkasan], ['transaksi', 'Transaksi', Transaksi], ['dompet', 'Dompet', Dompet], ['tren', 'Tren', Tren], ['rencana', 'Rencana', Rencana]];
const FAB_TABS = ['ringkasan', 'transaksi', 'dompet'];

// Gerbang login: tampilkan aplikasi hanya kalau ada pengguna yang sudah masuk
export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(() => !!auth.get());
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setUnauthorizedHandler(() => { setUser(null); setNotice('Sesi berakhir, silakan masuk lagi.'); });
    if (!auth.get()) return;
    api.me().then(setUser).catch((e) => setNotice(e.message)).finally(() => setBooting(false));
  }, []);

  const logout = () => { auth.clear(); setNotice(''); setUser(null); };
  if (booting) return <main><Loading /></main>;
  if (!user) return <AuthScreen notice={notice} onAuthed={(u) => { setNotice(''); setUser(u); }} />;
  return <Shell user={user} logout={logout} />;
}

function Shell({ user, logout }) {
  const [acc, setAcc] = useState(false);
  const [pw, setPw] = useState(false);
  const [tab, setTab] = useState('ringkasan');
  const [month, setMonth] = useState(curMonth());
  const [ver, setVer] = useState(0);
  const [txDlg, setTxDlg] = useState({ open: false, tx: null });
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme'); } catch { return null; } });
  const meta = useApi(() => api.meta(), [ver]);
  const refresh = () => setVer((v) => v + 1);

  const dark = (theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  useEffect(() => {
    if (!theme) return;
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch { /* penyimpanan tidak tersedia */ }
  }, [theme]);
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

  const Page = TABS.find((t) => t[0] === tab)[2];
  const openTx = (tx = null) => setTxDlg({ open: true, tx });
  const closeTx = () => setTxDlg((s) => ({ ...s, open: false }));

  return (
    <>
      <main>
        <header>
          <h1 className="brand" aria-label="beFince"><LogoLockup /></h1>
          <div className="month">
            <button aria-label="Bulan sebelumnya" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <span>{monthLabel(month)}</span>
            <button aria-label="Bulan berikutnya" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
            <button aria-label="Akun" style={{ marginLeft: 6 }} onClick={() => setAcc(true)}>{user.name.trim()[0]?.toUpperCase() || '?'}</button>
            <button aria-label={dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'} style={{ marginLeft: 4 }} onClick={() => setTheme(dark ? 'light' : 'dark')}>{dark ? '☀' : '☾'}</button>
          </div>
        </header>
        {meta.error && <p className="note out" role="alert">{meta.error}</p>}
        {meta.data && <Page month={month} ver={ver} meta={meta.data} refresh={refresh} openTx={openTx} setTab={setTab} />}
      </main>

      <nav aria-label="Menu utama">
        <div className="tabs">
          {TABS.map(([k, label]) => (
            <button key={k} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
      </nav>
      {FAB_TABS.includes(tab) && <button className="fab" onClick={() => openTx()}>Catat transaksi</button>}

      <Dialog open={acc} onClose={() => setAcc(false)}>
        {acc && (
          <div style={{ display: 'grid', gap: 10 }}>
            <h2>Akun</h2>
            <p style={{ margin: 0 }}><b>{user.name}</b><br /><span className="note">{user.email}</span></p>
            <button className="ghost" onClick={() => { setAcc(false); setPw(true); }}>Ganti kata sandi</button>
            <button className="save" onClick={logout}>Keluar</button>
            <button className="ghost" onClick={() => setAcc(false)}>Tutup</button>
          </div>
        )}
      </Dialog>
      <PasswordDialog open={pw} onClose={() => setPw(false)} />
      <TxDialog open={txDlg.open} tx={txDlg.tx} meta={meta.data} month={month} onClose={closeTx}
        onSaved={() => { closeTx(); refresh(); }} />
    </>
  );
}
