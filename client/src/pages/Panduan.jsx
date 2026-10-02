import { Fragment, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { GUIDE, plain } from '../guideContent';
import { curMonth } from '../util';

// **tebal** dan `kode` di dalam kalimat
function Rich({ text }) {
  return String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith('**')) return <b key={i}>{p.slice(2, -2)}</b>;
    if (p.startsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

function Block({ b }) {
  if (b.t === 'p') return <p><Rich text={b.x} /></p>;
  if (b.t === 'steps') return <ol>{b.x.map((s, i) => <li key={i}><Rich text={s} /></li>)}</ol>;
  if (b.t === 'list') return <ul>{b.x.map((s, i) => <li key={i}><Rich text={s} /></li>)}</ul>;
  if (b.t === 'tip') return <p className="gtip">💡 <Rich text={b.x} /></p>;
  if (b.t === 'warn') return <p className="gwarn">⚠️ <Rich text={b.x} /></p>;
  if (b.t === 'qa') return <div className="qa"><b>{b.q}</b><span><Rich text={b.a} /></span></div>;
  return null;
}

const STEPS = [
  { id: 'akun', text: 'Buat akun dan masuk', done: () => true },
  { id: 'saldo', text: 'Isi saldo awal dompet', go: 'kelola', label: 'Buka Kelola', done: (d) => d.wallets.some((w) => w.opening_balance > 0) },
  { id: 'catat', text: 'Catat transaksi pertama', go: 'catat', label: 'Catat', done: (d) => d.tx > 0 },
  { id: 'budget', text: 'Atur budget bulan ini', go: 'rencana', label: 'Buka Rencana', done: (d) => d.budget },
  { id: 'target', text: 'Buat target tabungan', go: 'rencana', label: 'Buka Rencana', done: (d) => d.goals > 0 },
  { id: 'impor', text: 'Coba impor mutasi (opsional)', go: 'transaksi', label: 'Buka Transaksi', optional: true },
];

// Daftar langkah awal; tandanya dihitung dari datamu sendiri
function QuickStart({ onNavigate }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      api.wallets('2099-12'),
      api.transactions({ from: '2000-01-01', to: '2099-12-31', limit: 1 }),
      api.budgets(curMonth()),
      api.goals(),
    ]).then(([w, t, b, g]) => live && setD({ wallets: w.wallets, tx: t.length, budget: b.items.some((i) => i.budget > 0), goals: g.length }))
      .catch(() => live && setD(null));
    return () => { live = false; };
  }, []);
  const required = STEPS.filter((s) => !s.optional);
  const done = (s) => (d ? !!s.done?.(d) : s.id === 'akun');
  const n = required.filter(done).length;
  return (
    <div className="qs" aria-label="Langkah awal">
      <div className="lbl2">{n} dari {required.length} selesai</div>
      <div className="bar2"><i style={{ width: (n / required.length) * 100 + '%', background: 'var(--in)' }} /></div>
      {STEPS.map((s) => (
        <div className={'ck' + (done(s) ? ' ok' : '')} key={s.id}>
          <span className="cb" aria-hidden="true">{done(s) ? '✓' : ''}</span>
          <span className="ct">{s.text}{done(s) && <span className="sr"> (selesai)</span>}</span>
          {s.go && !done(s) && <button className="lnk" onClick={() => onNavigate(s.go)}>{s.label}</button>}
        </div>
      ))}
    </div>
  );
}

export default function Panduan({ initial, onClose, onNavigate }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(() => new Set([initial || 'mulai']));
  const refs = useRef({});
  const term = q.trim().toLowerCase();
  const shown = GUIDE.filter((s) => !term || plain(s).includes(term));

  useEffect(() => {
    if (initial) refs.current[initial]?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [initial]);

  const toggle = (id) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const jump = (id) => {
    setQ('');
    setOpen((o) => new Set(o).add(id));
    setTimeout(() => refs.current[id]?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 60);
  };

  return (
    <div className="page guide" id="p-panduan">
      <section className="card" aria-label="Panduan pengguna">
        <div className="hd"><h2>Panduan pengguna</h2><button onClick={onClose}>Tutup</button></div>
        <p className="note" style={{ margin: '0 0 10px' }}>Cara memakai beFince, dari mencatat transaksi sampai mengimpor mutasi bank.</p>
        <input type="search" placeholder="Cari di panduan, misalnya transfer atau duplikat" aria-label="Cari di panduan" value={q} onChange={(e) => setQ(e.target.value)} />
        {!term && (
          <div className="chips" style={{ marginTop: 10 }} aria-label="Isi panduan">
            {GUIDE.map((s) => <button key={s.id} onClick={() => jump(s.id)}>{s.icon} {s.title}</button>)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
          <button className="lnk" style={{ marginLeft: 0 }} onClick={() => setOpen(new Set(GUIDE.map((s) => s.id)))}>Buka semua</button>
          <button className="lnk" onClick={() => setOpen(new Set())}>Tutup semua</button>
        </div>
      </section>

      {term && shown.length === 0 && <section className="card"><p className="note" style={{ margin: 0 }}>Tidak ada hasil untuk "{q}". Coba kata lain, misalnya "saldo", "impor", atau "budget".</p></section>}

      {shown.map((s) => {
        const isOpen = term ? true : open.has(s.id);
        return (
          <section className="card gs" key={s.id} ref={(el) => { refs.current[s.id] = el; }} aria-label={s.title}>
            <button className="gs-h" aria-expanded={isOpen} aria-controls={`g-${s.id}`} onClick={() => !term && toggle(s.id)}>
              <span className="ic">{s.icon}</span>
              <span><b>{s.title}</b><small>{s.summary}</small></span>
              <span className="chev" aria-hidden="true">›</span>
            </button>
            {isOpen && (
              <div className="gs-b" id={`g-${s.id}`}>
                {s.id === 'mulai' && <QuickStart onNavigate={onNavigate} />}
                {s.blocks.map((b, i) => <Block key={i} b={b} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
