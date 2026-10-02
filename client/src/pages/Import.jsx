import { useState } from 'react';
import { api } from '../api';
import { extractRows, parseText, readTable } from '../importer';
import { parseStatement } from '../statement';
import { Err, Field, MoneyInput } from '../ui';
import { monthShort, rp, today } from '../util';

const MAX = 1000;
const MAP_FIELDS = [['date', 'Tanggal'], ['desc', 'Keterangan'], ['debit', 'Debit / uang keluar'], ['credit', 'Kredit / uang masuk'], ['amount', 'Jumlah (satu kolom)']];
const toMap = (c = {}) => ({ date: c.date ?? '', desc: c.desc?.[0] ?? '', debit: c.debit ?? '', credit: c.credit ?? '', amount: c.amount ?? '' });
const fromMap = (m) => {
  const n = (v) => (v === '' ? undefined : Number(v));
  return { date: n(m.date), desc: m.desc === '' ? [] : [Number(m.desc)], debit: n(m.debit), credit: n(m.credit), amount: n(m.amount) };
};

export default function ImportFlow({ meta, onClose, onDone }) {
  const [wallet, setWallet] = useState(meta.wallets[0]?.id || '');
  const [mode, setMode] = useState('file');
  const [raw, setRaw] = useState('');
  const [fname, setFname] = useState('');
  const [pdf, setPdf] = useState(null);
  const [stmt, setStmt] = useState(null);
  const [table, setTable] = useState(null);
  const [map, setMap] = useState(toMap());
  const [showMap, setShowMap] = useState(false);
  const [items, setItems] = useState(null);
  const [skipped, setSkipped] = useState(0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState(null);

  const catId = (name, type) => meta.categories.find((c) => c.type === type && name && c.name.toLowerCase() === name.toLowerCase())?.id || '';
  const apiItems = (list) => list.map((i) => ({ type: i.type, amount: i.amount, date: i.date, note: i.note }));

  async function prepare(list, skip) {
    if (list.length > MAX) throw new Error(`Maksimal ${MAX} baris per impor. Bagi berkas menjadi beberapa bagian.`);
    let dups = [];
    if (list.length) dups = (await api.importCheck({ wallet_id: Number(wallet), items: apiItems(list) })).duplicates;
    setItems(list.map((it, i) => ({ ...it, id: i, dup: dups[i], include: !dups[i] && !it.hint, category_id: catId(it.category, it.type) })));
    setSkipped(skip);
  }

  async function read() {
    setErr(''); setResult(null);
    if (!(mode === 'file' && pdf) && !raw.trim()) { setErr(mode === 'file' ? 'Pilih berkas dulu.' : 'Tempel teksnya dulu.'); return; }
    setBusy(true);
    try {
      setStmt(null);
      if (mode === 'file' && pdf) {
        setTable(null); setShowMap(false);
        const { extractPages } = await import('../pdfText');
        const r = parseStatement(await extractPages(pdf.buffer), today());
        setStmt({ period: r.period, verified: r.verified, mismatch: r.mismatch, monthOnly: r.monthOnly });
        await prepare(r.items, r.skipped);
      } else if (mode === 'text') {
        setTable(null); setShowMap(false);
        const r = parseText(raw, today());
        await prepare(r.items, r.skipped);
      } else {
        const t = readTable(raw, today());
        setTable(t); setMap(toMap(t.cols)); setShowMap(!t.ok);
        if (t.ok) await prepare(t.items, t.skipped); else setItems(null);
      }
    } catch (e) {
      setErr(e?.name === 'PasswordException' ? 'PDF ini terkunci sandi. Buka kuncinya dulu, simpan ulang tanpa sandi, lalu pilih lagi.'
        : e?.name === 'InvalidPDFException' ? 'Berkas ini bukan PDF yang valid.' : e.message || 'Berkas tidak bisa dibaca.');
    }
    setBusy(false);
  }

  async function applyMap() {
    setErr('');
    const cols = fromMap(map);
    if (cols.date === undefined || (cols.debit === undefined && cols.credit === undefined && cols.amount === undefined)) {
      setErr('Pilih minimal kolom tanggal dan satu kolom nominal.'); return;
    }
    setBusy(true);
    try {
      const r = extractRows(table.rows, cols, 0, today());
      await prepare(r.items, r.skipped);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (f.size > (isPdf ? 15_000_000 : 3_000_000)) { setErr(`Berkas terlalu besar (maksimal ${isPdf ? 15 : 3} MB).`); return; }
    setFname(f.name); setErr(''); setItems(null); setTable(null); setRaw(''); setPdf(null); setStmt(null); setReading(true);
    const rd = new FileReader();
    rd.onload = () => {
      if (isPdf) setPdf({ name: f.name, buffer: rd.result }); else setRaw(String(rd.result || ''));
      setReading(false);
    };
    rd.onerror = () => { setErr('Berkas tidak bisa dibaca.'); setReading(false); };
    if (isPdf) rd.readAsArrayBuffer(f); else rd.readAsText(f);
  }

  const upd = (id, patch) => setItems((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const flip = (x) => { const type = x.type === 'income' ? 'expense' : 'income'; upd(x.id, { type, category_id: catId(x.category, type) }); };
  const chosen = (items || []).filter((x) => x.include);
  const sum = (t) => chosen.filter((x) => x.type === t).reduce((a, x) => a + (Number(x.amount) || 0), 0);

  async function commit() {
    setErr('');
    if (chosen.some((x) => !(Number(x.amount) > 0) || !x.date)) { setErr('Ada baris dengan tanggal atau nominal yang belum benar.'); return; }
    setBusy(true);
    try {
      setResult(await api.importCommit({
        wallet_id: Number(wallet),
        items: chosen.map((x) => ({ type: x.type, amount: Math.round(Number(x.amount)), date: x.date, note: x.note, category_id: x.category_id || null, force: x.dup })),
      }));
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  if (result) {
    return (
      <section className="card imp" aria-label="Hasil impor">
        <h2>Impor selesai</h2>
        <p style={{ margin: 0 }}><b>{result.inserted}</b> transaksi disimpan{result.skipped ? `, ${result.skipped} dilewati sebagai duplikat` : ''}.</p>
        <button className="save" style={{ marginTop: 12, width: '100%' }} onClick={onDone}>Selesai</button>
      </section>
    );
  }

  const sample = (j) => { const r = table.rows.find((x) => x[j]); return r ? String(r[j]).slice(0, 18) : ''; };
  const ncols = table ? Math.max(0, ...table.rows.slice(0, 60).map((r) => r.length)) : 0;

  return (
    <>
      <section className="card imp" aria-label="Impor mutasi">
        <div className="hd"><h2>Impor mutasi</h2><button onClick={onClose}>Kembali</button></div>
        <Field label="Simpan ke dompet">
          <select value={wallet} onChange={(e) => { setWallet(e.target.value); setItems(null); }}>
            {meta.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <div className="seg" role="group" aria-label="Sumber data" style={{ margin: '12px 0' }}>
          <button type="button" className={mode === 'file' ? 'on' : ''} onClick={() => { setMode('file'); setItems(null); setErr(''); }}>Berkas CSV/PDF</button>
          <button type="button" className={mode === 'text' ? 'on' : ''} onClick={() => { setMode('text'); setItems(null); setErr(''); }}>Tempel teks</button>
        </div>
        {mode === 'file' ? (
          <label className="filebtn">
            <input type="file" accept=".csv,.tsv,.txt,.pdf,text/csv,text/plain,application/pdf" onChange={onFile} />
            <span>{fname || 'Pilih berkas mutasi (.csv atau e-statement .pdf)'}</span>
          </label>
        ) : (
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} aria-label="Teks mutasi atau notifikasi"
            placeholder={'Tempel notifikasi bank/e-wallet atau baris mutasi, contoh:\nPembayaran Rp25.000 ke Kopi Kenangan\n\nKamu menerima Rp150.000 dari Budi'} />
        )}
        <p className="note">
          {mode === 'file'
            ? 'Pilih e-statement PDF (yang berisi teks, bukan hasil scan atau foto) atau mutasi CSV. Excel (.xlsx) simpan dulu sebagai CSV. Berkasnya dibaca di perangkatmu dan belum dikirim ke server sebelum kamu menekan Simpan.'
            : 'Satu transaksi dipisahkan baris kosong, atau satu baris satu transaksi. Baris yang disalin dari e-statement PDF juga bisa dipakai.'}
        </p>
        <button className="save" style={{ width: '100%' }} disabled={busy || reading} onClick={read}>{busy || reading ? 'Membaca…' : 'Baca data'}</button>
        <Err msg={err} />
      </section>

      {table && (showMap || !table.ok) && (
        <section className="card imp" aria-label="Pemetaan kolom">
          <h2>Atur kolom</h2>
          <p className="note">{table.ok ? 'Kalau hasil bacaan keliru, pilih kolom yang benar.' : 'Kolom tidak dikenali otomatis. Pilih kolom yang sesuai.'}</p>
          {MAP_FIELDS.map(([k, label]) => (
            <Field key={k} label={label}>
              <select value={map[k]} onChange={(e) => setMap((m) => ({ ...m, [k]: e.target.value }))}>
                <option value="">(tidak ada)</option>
                {Array.from({ length: ncols }, (_, j) => <option key={j} value={j}>Kolom {j + 1}: {sample(j)}</option>)}
              </select>
            </Field>
          ))}
          <button className="save" style={{ width: '100%', marginTop: 8 }} disabled={busy} onClick={applyMap}>Terapkan kolom</button>
        </section>
      )}
      {table?.ok && !showMap && <button className="lnk" style={{ justifySelf: 'start' }} onClick={() => setShowMap(true)}>Hasil keliru? Atur kolom</button>}

      {items && (
        <section className="card imp" aria-label="Pratinjau impor">
          <h2>Periksa sebelum disimpan</h2>
          {items.length === 0 ? (
            <p className="note">Tidak ada transaksi yang terbaca{skipped ? ` (${skipped} baris dilewati)` : ''}. {pdf ? 'Kalau PDF-nya hasil scan atau foto, teksnya tidak bisa dibaca. Coba unduh versi e-statement asli dari aplikasi bank, atau salin barisnya ke Tempel teks.' : 'Cek isi berkas, atau coba Tempel teks.'}</p>
          ) : (
            <>
              {stmt && (
                <p className="note">
                  {stmt.period ? `Periode terbaca: ${+stmt.period.start.slice(8)} ${monthShort(stmt.period.start.slice(0, 7))} sampai ${+stmt.period.end.slice(8)} ${monthShort(stmt.period.end.slice(0, 7))}. ` : 'Periode tidak ditemukan; tanggal tanpa tahun memakai tahun berjalan. '}
                  {stmt.verified ? `Saldo cocok untuk ${stmt.verified} baris, jadi arah masuk atau keluarnya terverifikasi. ` : ''}
                  {stmt.mismatch ? `${stmt.mismatch} baris saldonya tidak cocok, periksa baris bertanda kuning.` : ''}
                </p>
              )}
              <p className="note imp-sum">
                {items.length} baris terbaca · {items.filter((x) => x.dup).length} mungkin sudah ada · {items.filter((x) => x.uncertain).length} perlu diperiksa{skipped ? ` · ${skipped} baris dilewati` : ''}
              </p>
              {items.map((x) => (
                <div className={'imp-row' + (x.include ? '' : ' off')} key={x.id}>
                  <input type="checkbox" checked={x.include} aria-label="Sertakan baris ini" onChange={(e) => upd(x.id, { include: e.target.checked })} />
                  <div className="imp-main">
                    <input value={x.note} maxLength="200" aria-label="Catatan" onChange={(e) => upd(x.id, { note: e.target.value })} />
                    <div className="imp-line">
                      <input type="date" value={x.date} aria-label="Tanggal" onChange={(e) => upd(x.id, { date: e.target.value })} />
                      <MoneyInput value={x.amount} aria-label="Nominal" onChange={(v) => upd(x.id, { amount: v })} />
                    </div>
                    <div className="imp-tt">
                      <button type="button" className={'tt ' + (x.type === 'income' ? 'in' : 'out')} onClick={() => flip(x)} aria-label="Ganti arah transaksi">
                        {x.type === 'income' ? 'Masuk' : 'Keluar'}
                      </button>
                      <select value={x.category_id} aria-label="Kategori" onChange={(e) => upd(x.id, { category_id: e.target.value })}>
                        <option value="">Tanpa kategori</option>
                        {meta.categories.filter((c) => c.type === x.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    {(x.dup || x.hint || x.uncertain) && (
                      <div className="imp-badges">
                        {x.dup && <span className="badge">Mungkin sudah ada</span>}
                        {x.hint && <span className="badge">Mungkin perpindahan antar dompet: lebih tepat dicatat sebagai Transfer</span>}
                        {x.uncertain && <span className="badge warn">{x.reason || 'Periksa arah dan nominal'}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <p className="note">Transaksi berbadge "perpindahan antar dompet" tidak dicentang otomatis supaya tidak tercatat ganda. Centang kalau memang pembelian.</p>
              <button className="save" style={{ width: '100%' }} disabled={busy || !chosen.length} onClick={commit}>
                {busy ? 'Menyimpan…' : `Simpan ${chosen.length} transaksi`}
              </button>
              <p className="note" style={{ textAlign: 'center' }}>Keluar {rp(sum('expense'))} · Masuk {rp(sum('income'))}</p>
              <Err msg={err} />
            </>
          )}
        </section>
      )}
    </>
  );
}
