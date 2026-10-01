import { useState } from 'react';
import { api, auth } from './api';
import { Err } from './ui';
import { LogoFull } from './Logo';

export default function AuthScreen({ onAuthed, notice }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const reg = mode === 'register';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await (reg ? api.register(f) : api.login({ email: f.email, password: f.password }));
      auth.set(r.token);
      onAuthed(r.user);
    } catch (x) {
      setErr(x.message); setBusy(false);
    }
  };

  return (
    <main className="auth">
      <h1 className="auth-logo" aria-label="beFince"><LogoFull /></h1>
      <section className="card hero" aria-label="Selamat datang">
        <div className="lbl">{reg ? 'Buat akun baru' : 'Masuk ke akunmu'}</div>
        <div className="big" style={{ fontSize: '1.6rem', margin: '4px 0 0' }}>Uangmu, tercatat rapi.</div>
      </section>
      <section className="card">
        <div className="seg" role="group" aria-label="Masuk atau daftar" style={{ marginBottom: 12 }}>
          <button type="button" className={!reg ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); }}>Masuk</button>
          <button type="button" className={reg ? 'on' : ''} onClick={() => { setMode('register'); setErr(''); }}>Daftar</button>
        </div>
        <form onSubmit={submit}>
          {reg && <input required maxLength="60" placeholder="Nama" aria-label="Nama" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} />}
          <input required type="email" maxLength="120" placeholder="Email" aria-label="Email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
          <input required type="password" minLength={reg ? 8 : undefined} maxLength="128" placeholder={reg ? 'Kata sandi (minimal 8 karakter)' : 'Kata sandi'} aria-label="Kata sandi"
            autoComplete={reg ? 'new-password' : 'current-password'} value={f.password} onChange={(e) => set('password', e.target.value)} />
          {notice && !err && <p className="note">{notice}</p>}
          <Err msg={err} />
          <button className="save" disabled={busy}>{busy ? 'Memproses…' : reg ? 'Buat akun' : 'Masuk'}</button>
        </form>
      </section>
    </main>
  );
}
