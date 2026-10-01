import { useState } from 'react';
import { Dialog, Err, Field } from './ui';
import { api, auth } from './api';
import { defaultDate, rp, today } from './util';

function useSubmit(action, done) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await action(); done(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return { err, busy, submit };
}
const useForm = (init) => {
  const [f, setF] = useState(init);
  return [f, (k, v) => setF((s) => ({ ...s, [k]: v })), setF];
};
const Actions = ({ busy, label, onClose }) => (
  <>
    <button className="save" disabled={busy}>{busy ? 'Menyimpan…' : label}</button>
    <button type="button" className="ghost" onClick={onClose}>Batal</button>
  </>
);

/* ---------- transaksi ---------- */
export function TxDialog({ open, tx, meta, month, onClose, onSaved }) {
  return <Dialog open={open} onClose={onClose}>{meta && <TxForm tx={tx} meta={meta} month={month} onClose={onClose} onSaved={onSaved} />}</Dialog>;
}
function TxForm({ tx, meta, month, onClose, onSaved }) {
  const [f, set, setF] = useForm(() => tx
    ? { type: tx.type, amount: tx.amount, category_id: tx.category_id || '', wallet_id: tx.wallet_id, date: tx.date, note: tx.note }
    : { type: 'expense', amount: '', category_id: '', wallet_id: meta.wallets[0]?.id || '', date: defaultDate(month), note: '' });
  const { err, busy, submit } = useSubmit(() => {
    const b = { ...f, amount: Number(f.amount), category_id: f.category_id || null, wallet_id: Number(f.wallet_id) };
    return tx ? api.updTx(tx.id, b) : api.addTx(b);
  }, onSaved);
  return (
    <form onSubmit={submit}>
      <h2>{tx ? 'Ubah transaksi' : 'Catat transaksi'}</h2>
      <div className="seg" role="group" aria-label="Jenis transaksi">
        {[['expense', 'Pengeluaran'], ['income', 'Pemasukan']].map(([v, l]) => (
          <button type="button" key={v} className={f.type === v ? 'on' : ''}
            onClick={() => setF((s) => ({ ...s, type: v, category_id: '' }))}>{l}</button>
        ))}
      </div>
      <input type="number" min="1" step="1" inputMode="numeric" required placeholder="Nominal (Rp)" aria-label="Nominal"
        value={f.amount} onChange={(e) => set('amount', e.target.value)} />
      <Field label="Kategori">
        <select value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
          <option value="">Tanpa kategori</option>
          {meta.categories.filter((c) => c.type === f.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Dompet">
        <select value={f.wallet_id} onChange={(e) => set('wallet_id', e.target.value)}>
          {meta.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </Field>
      <input type="date" required value={f.date} aria-label="Tanggal" onChange={(e) => set('date', e.target.value)} />
      <input placeholder="Catatan (opsional)" maxLength="200" aria-label="Catatan" value={f.note} onChange={(e) => set('note', e.target.value)} />
      <Err msg={err} />
      <Actions busy={busy} label="Simpan transaksi" onClose={onClose} />
    </form>
  );
}

/* ---------- transfer antar dompet ---------- */
export function TransferDialog({ open, wallets, month, onClose, onSaved }) {
  return <Dialog open={open} onClose={onClose}>{wallets && <TransferForm wallets={wallets} month={month} onClose={onClose} onSaved={onSaved} />}</Dialog>;
}
function TransferForm({ wallets, month, onClose, onSaved }) {
  const bank = wallets.find((w) => w.kind === 'bank') || wallets[0];
  const [f, set] = useForm({
    from_wallet: bank.id, to_wallet: (wallets.find((w) => w.id !== bank.id) || bank).id,
    amount: '', date: defaultDate(month), note: '',
  });
  const { err, busy, submit } = useSubmit(
    () => api.addTransfer({ ...f, from_wallet: Number(f.from_wallet), to_wallet: Number(f.to_wallet), amount: Number(f.amount) }), onSaved);
  const opts = wallets.map((w) => <option key={w.id} value={w.id}>{w.name} · {rp(w.balance)}</option>);
  return (
    <form onSubmit={submit}>
      <h2>Transfer antar dompet</h2>
      <Field label="Dari"><select value={f.from_wallet} onChange={(e) => set('from_wallet', e.target.value)}>{opts}</select></Field>
      <Field label="Ke"><select value={f.to_wallet} onChange={(e) => set('to_wallet', e.target.value)}>{opts}</select></Field>
      <input type="number" min="1" step="1" inputMode="numeric" required placeholder="Nominal (Rp)" aria-label="Nominal"
        value={f.amount} onChange={(e) => set('amount', e.target.value)} />
      <input type="date" required value={f.date} aria-label="Tanggal" onChange={(e) => set('date', e.target.value)} />
      <input placeholder="Catatan (opsional)" maxLength="60" aria-label="Catatan" value={f.note} onChange={(e) => set('note', e.target.value)} />
      <p className="note">Transfer hanya memindahkan saldo, tidak dihitung sebagai pemasukan atau pengeluaran.</p>
      <Err msg={err} />
      <Actions busy={busy} label="Pindahkan saldo" onClose={onClose} />
    </form>
  );
}

/* ---------- budget ---------- */
export function BudgetDialog({ open, month, items, onClose, onSaved }) {
  return <Dialog open={open} onClose={onClose}>{items && <BudgetForm month={month} items={items} onClose={onClose} onSaved={onSaved} />}</Dialog>;
}
function BudgetForm({ month, items, onClose, onSaved }) {
  const [vals, setVals] = useState(() => Object.fromEntries(items.map((i) => [i.category_id, i.budget || ''])));
  const [err2, setErr2] = useState('');
  const { err, busy, submit } = useSubmit(
    () => api.saveBudgets(month, items.map((i) => ({ category_id: i.category_id, amount: Number(vals[i.category_id]) || 0 }))), onSaved);
  const suggest = async () => {
    setErr2('');
    try {
      const rows = await api.budgetSuggest(month);
      setVals(Object.fromEntries(rows.map((r) => [r.category_id, r.avg || ''])));
    } catch (e) { setErr2(e.message); }
  };
  return (
    <form onSubmit={submit}>
      <h2>Atur budget</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((i) => (
          <label className="brow" key={i.category_id}>
            <span>{i.name}</span>
            <input type="number" min="0" step="10000" inputMode="numeric" placeholder="Tanpa budget" aria-label={`Budget ${i.name}`}
              value={vals[i.category_id]} onChange={(e) => setVals((s) => ({ ...s, [i.category_id]: e.target.value }))} />
          </label>
        ))}
      </div>
      <p className="note">Kosongkan atau isi 0 kalau kategori tidak perlu budget. Bulan berikutnya otomatis memakai budget ini sampai kamu mengubahnya.</p>
      <button type="button" className="ghost" onClick={suggest}>Isi dari rata-rata 3 bulan terakhir</button>
      <Err msg={err || err2} />
      <Actions busy={busy} label="Simpan budget" onClose={onClose} />
    </form>
  );
}

/* ---------- target tabungan ---------- */
const EMOJIS = ['🎯', '🛟', '💻', '🌴', '🏠', '🚗', '📱', '🎓'];
export function GoalDialog({ open, onClose, onSaved }) {
  return <Dialog open={open} onClose={onClose}>{open && <GoalForm onClose={onClose} onSaved={onSaved} />}</Dialog>;
}
function GoalForm({ onClose, onSaved }) {
  const [f, set] = useForm({ emoji: '🎯', name: '', target: '', saved_before: '', deadline: '' });
  const { err, busy, submit } = useSubmit(() => api.addGoal({
    emoji: f.emoji, name: f.name, target: Number(f.target),
    saved_before: Number(f.saved_before) || 0, deadline: f.deadline || null,
  }), onSaved);
  return (
    <form onSubmit={submit}>
      <h2>Target tabungan baru</h2>
      <div className="seg" style={{ gridTemplateColumns: 'repeat(8,1fr)' }} role="group" aria-label="Ikon">
        {EMOJIS.map((e) => <button type="button" key={e} className={f.emoji === e ? 'on' : ''} aria-label={`Ikon ${e}`} onClick={() => set('emoji', e)}>{e}</button>)}
      </div>
      <input required maxLength="40" placeholder="Nama target, misalnya Laptop baru" aria-label="Nama target" value={f.name} onChange={(e) => set('name', e.target.value)} />
      <input type="number" min="1" step="1" required inputMode="numeric" placeholder="Nominal target (Rp)" aria-label="Nominal target" value={f.target} onChange={(e) => set('target', e.target.value)} />
      <input type="number" min="0" step="1" inputMode="numeric" placeholder="Tabungan yang sudah ada (opsional)" aria-label="Tabungan awal" value={f.saved_before} onChange={(e) => set('saved_before', e.target.value)} />
      <Field label="Tenggat (opsional)"><input type="month" value={f.deadline} onChange={(e) => set('deadline', e.target.value)} /></Field>
      <Err msg={err} />
      <Actions busy={busy} label="Buat target" onClose={onClose} />
    </form>
  );
}

export function DepositDialog({ goal, wallets, onClose, onSaved }) {
  return <Dialog open={!!goal} onClose={onClose}>{goal && wallets && <DepositForm goal={goal} wallets={wallets} onClose={onClose} onSaved={onSaved} />}</Dialog>;
}
function DepositForm({ goal, wallets, onClose, onSaved }) {
  const [f, set] = useForm({ wallet_id: wallets[0]?.id || '', amount: '', date: today(), note: '' });
  const { err, busy, submit } = useSubmit(
    () => api.deposit(goal.id, { ...f, wallet_id: Number(f.wallet_id), amount: Number(f.amount) }), onSaved);
  return (
    <form onSubmit={submit}>
      <h2>Setor ke {goal.emoji} {goal.name}</h2>
      <Field label="Ambil dari dompet">
        <select value={f.wallet_id} onChange={(e) => set('wallet_id', e.target.value)}>
          {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </Field>
      <input type="number" min="1" step="1" required inputMode="numeric" placeholder="Nominal setoran (Rp)" aria-label="Nominal setoran" value={f.amount} onChange={(e) => set('amount', e.target.value)} />
      <input type="date" required value={f.date} aria-label="Tanggal" onChange={(e) => set('date', e.target.value)} />
      <input placeholder="Catatan (opsional)" maxLength="60" aria-label="Catatan" value={f.note} onChange={(e) => set('note', e.target.value)} />
      <p className="note">Setoran mengurangi saldo dompet yang dipilih, tapi tidak dihitung sebagai pengeluaran.</p>
      <Err msg={err} />
      <Actions busy={busy} label="Setor" onClose={onClose} />
    </form>
  );
}

/* ---------- ganti kata sandi ---------- */
export function PasswordDialog({ open, onClose }) {
  return <Dialog open={open} onClose={onClose}>{open && <PasswordForm onClose={onClose} />}</Dialog>;
}
function PasswordForm({ onClose }) {
  const [f, set] = useForm({ cur: '', neu: '', neu2: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.neu !== f.neu2) { setErr('Konfirmasi kata sandi baru tidak sama'); return; }
    setBusy(true);
    try {
      const r = await api.changePassword({ current_password: f.cur, new_password: f.neu });
      auth.set(r.token); // token baru untuk perangkat ini; token di perangkat lain otomatis tidak berlaku
      setDone(true);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  if (done) {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <h2>Kata sandi diganti</h2>
        <p className="note">Perangkat ini tetap masuk. Perangkat lain yang sedang masuk akan otomatis keluar.</p>
        <button className="save" onClick={onClose}>Selesai</button>
      </div>
    );
  }
  return (
    <form onSubmit={submit}>
      <h2>Ganti kata sandi</h2>
      <input type="password" required maxLength="128" autoComplete="current-password" placeholder="Kata sandi saat ini" aria-label="Kata sandi saat ini" value={f.cur} onChange={(e) => set('cur', e.target.value)} />
      <input type="password" required minLength="8" maxLength="128" autoComplete="new-password" placeholder="Kata sandi baru (minimal 8 karakter)" aria-label="Kata sandi baru" value={f.neu} onChange={(e) => set('neu', e.target.value)} />
      <input type="password" required minLength="8" maxLength="128" autoComplete="new-password" placeholder="Ulangi kata sandi baru" aria-label="Ulangi kata sandi baru" value={f.neu2} onChange={(e) => set('neu2', e.target.value)} />
      <Err msg={err} />
      <Actions busy={busy} label="Simpan kata sandi" onClose={onClose} />
    </form>
  );
}
