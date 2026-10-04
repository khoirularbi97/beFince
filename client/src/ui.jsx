import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { caretAfterDigits, cleanDigits, fmtDigits, pastedDigits } from './money';

export function Dialog({ open, onClose, children }) {
  const ref = useRef();
  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return <dialog ref={ref} onClose={onClose}>{open && children}</dialog>;
}

export const Err = ({ msg }) => (msg ? <p className="note out" role="alert">{msg}</p> : null);
// true kalau `active` sudah berlangsung lebih dari `ms` (server gratis di Render bisa butuh sekitar satu menit untuk bangun)
export function useSlow(active, ms = 6000) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) { setSlow(false); return undefined; }
    const t = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return slow;
}
export const WAKE_HINT = 'Server sedang bangun dari tidur (paket gratis), tunggu sekitar satu menit.';
export function Loading({ err }) {
  const slow = useSlow(!err);
  return <p className="note" role="status">{err || 'Memuat…'}{!err && slow && ` ${WAKE_HINT}`}</p>;
}
export const Field = ({ label, children }) => <label className="lb">{label}{children}</label>;

// Efek miring 3D mengikuti kursor (hanya mouse, mati jika pengguna memilih kurangi gerakan)
export const tilt = {
  onPointerMove(e) {
    if (e.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${-y * 9}deg) rotateY(${x * 11}deg) translateY(-3px)`;
    el.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
    el.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
  },
  onPointerLeave(e) { e.currentTarget.style.transform = ''; },
};

// Isian nominal rupiah: tampil sebagai 1.500.000 saat diketik, nilainya (onChange) berupa angka saja: "1500000".
// Kursor tetap di tempatnya saat titik pemisah ditambahkan, dan teks tempelan seperti "Rp 1.500.000,00" dibaca dengan benar.
export function MoneyInput({ value, onChange, className = '', ...rest }) {
  const ref = useRef(null);
  const caret = useRef(null);
  const shown = fmtDigits(value);
  useLayoutEffect(() => {
    if (caret.current !== null && ref.current && document.activeElement === ref.current) ref.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });
  const change = (e) => {
    const raw = e.target.value;
    const pos = e.target.selectionStart ?? raw.length;
    const before = raw.slice(0, pos).replace(/\D/g, '').length;
    const d = cleanDigits(raw);
    caret.current = caretAfterDigits(fmtDigits(d), before);
    onChange(d);
  };
  const paste = (e) => {
    const t = e.clipboardData?.getData('text') || '';
    if (/^\d*$/.test(t.trim())) return; // angka biasa: biarkan perilaku normal
    const d = pastedDigits(t);
    if (d) { e.preventDefault(); caret.current = fmtDigits(d).length; onChange(d); }
  };
  return (
    <span className={'money ' + className}>
      <span aria-hidden="true">Rp</span>
      <input ref={ref} type="text" inputMode="numeric" autoComplete="off" value={shown} onChange={change} onPaste={paste}
        pattern="[1-9][0-9.]*" title="Isi nominal lebih dari 0" {...rest} />
    </span>
  );
}

// Isian kata sandi dengan tombol mata untuk menampilkan atau menyembunyikan. Selalu mulai tersembunyi.
const eyeProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' };
const Eye = () => <svg {...eyeProps}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
const EyeOff = () => <svg {...eyeProps}><path d="M3 3l18 18" /><path d="M10.6 5.1A10.7 10.7 0 0112 5c6.4 0 10 7 10 7a17.6 17.6 0 01-3.2 4.1M6.5 6.6C3.8 8.3 2 12 2 12s3.6 7 10 7a9.9 9.9 0 004.4-1" /><path d="M9.9 9.9a3 3 0 004.2 4.2" /></svg>;
export function PasswordInput({ className = '', ...rest }) {
  const [show, setShow] = useState(false);
  const name = String(rest['aria-label'] || 'Kata sandi').toLowerCase();
  return (
    <span className={'pw ' + className}>
      <input {...rest} type={show ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="button" className="pw-eye" aria-pressed={show} aria-label={`${show ? 'Sembunyikan' : 'Tampilkan'} ${name}`}
        onMouseDown={(e) => e.preventDefault() /* jaga fokus dan posisi kursor di isian */} onClick={() => setShow((v) => !v)}>
        {show ? <EyeOff /> : <Eye />}
      </button>
    </span>
  );
}
