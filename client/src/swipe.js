// Geser kiri/kanan untuk pindah tab. Logika keputusan dipisah dari DOM supaya bisa diuji.
export const SWIPE = {
  min: 56,        // jarak geser minimal (px)
  ratio: 1.6,     // gerakan harus jelas lebih horizontal daripada vertikal
  maxTime: 900,   // geser yang terlalu lama (lebih dari sekitar 1 detik) dianggap menyeret pelan, bukan pindah tab
  edge: 24,       // sentuhan yang dimulai di tepi layar dibiarkan untuk gestur "kembali" milik HP
};

// Hasil: 'next' (geser ke kiri, tab berikutnya), 'prev' (geser ke kanan, tab sebelumnya), atau null
export function swipeDirection({ dx, dy, dt, startX, width }) {
  if (startX < SWIPE.edge || startX > width - SWIPE.edge) return null;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < SWIPE.min || ax < ay * SWIPE.ratio || dt > SWIPE.maxTime) return null;
  return dx < 0 ? 'next' : 'prev';
}

// Sentuhan di area yang punya geseran sendiri tidak boleh memindahkan tab: daftar dompet, chip, slider, isian teks, dsb.
export function blocksSwipe(target) {
  for (let el = target; el && el.nodeType === 1 && el !== document.body; el = el.parentElement) {
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true;
    const ox = getComputedStyle(el).overflowX;
    if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1) return true;
  }
  return false;
}

// Arah animasi masuk: tab bernomor lebih besar masuk dari kanan, lebih kecil dari kiri
export const slideFrom = (keys, from, to) => (keys.indexOf(to) > keys.indexOf(from) ? 'from-right' : 'from-left');
