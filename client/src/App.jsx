import { useEffect, useRef, useState } from 'react';
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
import Kelola from './pages/Kelola';
import Panduan from './pages/Panduan';
import Analisa from './pages/Analisa';
import { blocksSwipe, slideFrom, swipeDirection } from './swipe';

const TABS = [['ringkasan', 'Ringkasan', Ringkasan], ['transaksi', 'Transaksi', Transaksi], ['dompet', 'Dompet', Dompet], ['tren', 'Tren', Tren], ['rencana', 'Rencana', Rencana]];
const FAB_TABS = ['ringkasan', 'transaksi', 'dompet'];
const TAB_KEYS = TABS.map((t) => t[0]);

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
  const [view, setView] = useState(null); // halaman tambahan di luar tab: null | 'kelola' | 'panduan'
  const [guideAt, setGuideAt] = useState(null); // bagian panduan yang dibuka pertama
  const [tab, setTabState] = useState('ringkasan');
  const [slide, setSlide] = useState('');
  const tabRef = useRef('ringkasan');
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

  // Pindah tab (ketuk menu atau geser). Arah animasi ditentukan dari urutan tab.
  const setTab = (next) => {
    if (next === tabRef.current) return;
    setSlide(slideFrom(TAB_KEYS, tabRef.current, next));
    tabRef.current = next;
    setTabState(next);
  };
  const viewRef = useRef(null);
  viewRef.current = view;
  const setTabRef = useRef(setTab);
  setTabRef.current = setTab;

  // Geser kiri/kanan di halaman untuk pindah ke tab berikutnya atau sebelumnya
  useEffect(() => {
    let s = null;
    const allowed = () => !viewRef.current
      && !document.querySelector('dialog[open], #p-impor')              // ada jendela terbuka atau sedang impor mutasi
      && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || ''); // sedang mengetik
    const start = (e) => {
      if (e.touches.length !== 1 || !allowed() || blocksSwipe(e.target)) { s = null; return; }
      s = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    };
    const end = (e) => {
      if (!s) return;
      const t = e.changedTouches[0];
      const dir = swipeDirection({ dx: t.clientX - s.x, dy: t.clientY - s.y, dt: Date.now() - s.t, startX: s.x, width: window.innerWidth });
      s = null;
      if (!dir) return;
      const i = TAB_KEYS.indexOf(tabRef.current) + (dir === 'next' ? 1 : -1);
      if (TAB_KEYS[i]) setTabRef.current(TAB_KEYS[i]);
    };
    const cancel = () => { s = null; };
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', cancel);
    };
  }, []);

  const Page = TABS.find((t) => t[0] === tab)[2];
  const openTx = (tx = null) => setTxDlg({ open: true, tx });
  const openGuide = (section = null) => { setGuideAt(section); setView('panduan'); };
  // Tujuan dari daftar langkah awal di panduan
  const go = (target) => {
    setView(null);
    if (target === 'catat') openTx();
    else if (target === 'kelola') setView('kelola');
    else setTab(target);
  };
  const closeTx = () => setTxDlg((s) => ({ ...s, open: false }));

  return (
    <>
      <main>
        <header>
          <h1 className="brand" aria-label="beFince"><LogoLockup /></h1>
          <div className="tools">
            <button aria-label="Panduan pengguna" onClick={() => openGuide()}>?</button>
            <button aria-label="Akun" onClick={() => setAcc(true)}>{user.name.trim()[0]?.toUpperCase() || '?'}</button>
            <button aria-label={dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'} onClick={() => setTheme(dark ? 'light' : 'dark')}>{dark ? '☀' : '☾'}</button>
          </div>
          <div className="month">
            <button aria-label="Bulan sebelumnya" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <span>{monthLabel(month)}</span>
            <button aria-label="Bulan berikutnya" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </div>
        </header>
        {meta.error && <p className="note out" role="alert">{meta.error}</p>}
        {meta.data && (view === 'kelola'
          ? <Kelola ver={ver} refresh={refresh} onClose={() => setView(null)} />
          : view === 'analisa'
            ? <Analisa month={month} ver={ver} refresh={refresh} onClose={() => setView(null)} />
            : view === 'panduan'
            ? <Panduan key={guideAt || 'awal'} initial={guideAt} onClose={() => setView(null)} onNavigate={go} />
            : <div className={'pg ' + slide} key={tab}><Page month={month} ver={ver} meta={meta.data} refresh={refresh} openTx={openTx} setTab={setTab} openGuide={openGuide} openAnalisa={() => setView('analisa')} /></div>)}
      </main>

      <nav aria-label="Menu utama">
        <div className="tabs">
          {TABS.map(([k, label]) => (
            <button key={k} aria-current={!view && tab === k ? 'page' : undefined} onClick={() => { setView(null); setTab(k); }}>{label}</button>
          ))}
        </div>
      </nav>
      {!view && FAB_TABS.includes(tab) && <button className="fab" onClick={() => openTx()}>Catat transaksi</button>}

      <Dialog open={acc} onClose={() => setAcc(false)}>
        {acc && (
          <div style={{ display: 'grid', gap: 10 }}>
            <h2>Akun</h2>
            <p style={{ margin: 0 }}><b>{user.name}</b><br /><span className="note">{user.email}</span></p>
            <button className="ghost" onClick={() => { setAcc(false); openGuide(); }}>Panduan pengguna</button>
            <button className="ghost" onClick={() => { setAcc(false); setView('kelola'); }}>Kelola dompet dan kategori</button>
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
