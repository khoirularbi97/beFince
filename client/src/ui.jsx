import { useEffect, useRef, useState } from 'react';

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
