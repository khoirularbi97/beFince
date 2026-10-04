import { useState } from 'react';
import { api } from '../api';
import { useApi } from '../hooks';
import { Err, Loading } from '../ui';
import { monthLabel } from '../util';

const HEALTH = { baik: ['Baik', 'ok'], perlu_perhatian: ['Perlu perhatian', 'mid'], waspada: ['Waspada', 'bad'] };
const ICON = { good: '✅', info: 'ℹ️', warn: '⚠️' };
const HORIZON = [['minggu_ini', 'Minggu ini'], ['30_hari', '30 hari ke depan'], ['3_bulan', '3 bulan ke depan']];

// Tampilan satu laporan (aturan atau AI)
function ReportView({ report }) {
  const [label, tone] = HEALTH[report.health] || HEALTH.perlu_perhatian;
  return (
    <div className="rep">
      <p className="rep-head"><span className={'pill ' + tone}>{label}</span> {report.headline}</p>
      <h3>Temuan</h3>
      <ul className="fnd">
        {report.findings.map((f, i) => (
          <li key={i}><span aria-hidden="true">{ICON[f.severity] || 'ℹ️'}</span><div><b>{f.title}</b><span>{f.detail}</span></div></li>
        ))}
      </ul>
      <h3>Langkah ke depan</h3>
      {HORIZON.map(([k, title]) => {
        const items = report.steps.filter((s) => s.horizon === k);
        return items.length ? (
          <div className="stp" key={k}>
            <h4>{title}</h4>
            <ol>{items.map((s, i) => <li key={i}><b>{s.title}</b><span>{s.how}</span>{s.why && <small>{s.why}</small>}</li>)}</ol>
          </div>
        ) : null;
      })}
      {report.watch?.length > 0 && (<><h3>Perlu dipantau</h3><ul className="plain">{report.watch.map((w, i) => <li key={i}>{w}</li>)}</ul></>)}
      {report.missing_data?.length > 0 && (<><h3>Data yang kurang</h3><ul className="plain">{report.missing_data.map((w, i) => <li key={i}>{w}</li>)}</ul></>)}
      {report.evidence?.length > 0 && (
        <details className="ev"><summary>Angka yang dipakai ({report.evidence.length})</summary>
          <ul className="plain">{report.evidence.map((e) => <li key={e.key}>{e.label}: <b>{e.text}</b></li>)}</ul>
        </details>
      )}
    </div>
  );
}

const dateId = (iso) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export default function Analisa({ month, ver, refresh, onClose }) {
  const res = useApi(() => api.insights(month), [month, ver]);
  const [ai, setAi] = useState(null);      // laporan AI yang baru dibuat di halaman ini
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const d = res.data;
  if (!d) return <div className="page" id="p-analisa"><Loading err={res.error} /></div>;

  const state = d.ai;
  const shown = ai || (state.cached ? { report: state.cached, cached: true } : null);

  async function consent(granted) {
    setBusy('consent'); setErr('');
    try { await api.aiConsent(granted); if (!granted) setAi(null); refresh(); } catch (e) { setErr(e.message); }
    setBusy('');
  }
  async function generate(withConsent) {
    setBusy('ai'); setErr('');
    try {
      if (withConsent) await api.aiConsent(true);
      const r = await api.aiAnalysis(month, true);
      setAi({ report: r.report, cached: r.cached, remaining: r.remaining });
      refresh();
    } catch (e) { setErr(e.message); refresh(); }
    setBusy('');
  }

  return (
    <div className="page" id="p-analisa">
      <section className="card" aria-label="Analisa keuangan">
        <div className="hd"><h2>Analisa keuangan</h2><button onClick={onClose}>Tutup</button></div>
        <p className="note" style={{ margin: 0 }}>{monthLabel(month)}. Saran umum berdasarkan datamu, bukan nasihat keuangan profesional.</p>
      </section>

      <section className="card" aria-label="Analisa otomatis">
        <div className="hd"><h2>Analisa cepat</h2><span className="tag">Otomatis, tanpa AI</span></div>
        <ReportView report={d.report} />
        <p className="note">Dihitung langsung di server dari datamu dengan aturan umum (misalnya sisa uang, budget, dana darurat 3 bulan). Tidak ada data yang dikirim ke pihak lain.</p>
      </section>

      <section className="card" aria-label="Analisa AI">
        <div className="hd"><h2>Analisa AI</h2>{state.enabled && state.consent && <span className="tag">Sisa hari ini: {ai?.remaining ?? state.remaining}</span>}</div>
        {!state.enabled && <p className="note" style={{ margin: 0 }}>Analisa AI belum diaktifkan di server ini. Pemilik server bisa mengaktifkannya (lihat README). Analisa cepat di atas tetap bisa dipakai.</p>}

        {state.enabled && !d.enough && <p className="note" style={{ margin: 0 }}>Analisa AI butuh minimal 8 transaksi dalam 3 bulan terakhir. Catat atau impor transaksi dulu.</p>}

        {state.enabled && d.enough && !state.consent && (
          <div className="consent">
            <p style={{ margin: 0 }}>AI bisa menyusun saran yang lebih tertata dan dipersonalisasi dari datamu. Sebelum dipakai, ini yang perlu kamu tahu:</p>
            <ul>
              <li><b>Yang dikirim:</b> ringkasan angka (total pemasukan dan pengeluaran, kategori terbesar, budget, saldo, target tabungan).</li>
              <li><b>Tidak dikirim:</b> catatan transaksi, nama, email, nomor rekening, dan daftar transaksi lengkap.</li>
              <li>Dikirim ke <b>{state.provider}</b> (model {state.model}), penyedia pilihan pemilik server. Kebijakan penyimpanan data mengikuti penyedia itu, jadi baca dulu ketentuannya, terutama untuk tingkat gratis.</li>
              {state.notice && <li><b>Perhatikan:</b> {state.notice}</li>}
              <li>Semua angka tetap dihitung aplikasi, bukan ditebak AI. Hasilnya bisa tetap kurang tepat, jadi baca sebagai pertimbangan.</li>
              <li>Izin bisa dicabut kapan saja, dan laporan AI yang tersimpan ikut terhapus.</li>
            </ul>
            <button className="save" style={{ width: '100%' }} disabled={!!busy} onClick={() => generate(true)}>{busy === 'ai' ? 'Menyusun analisa…' : 'Izinkan dan buat analisa AI'}</button>
          </div>
        )}

        {state.enabled && d.enough && state.consent && (
          <>
            {shown ? (
              <>
                <p className="note" style={{ margin: '0 0 8px' }}>
                  {shown.report.demo ? 'Contoh tampilan (bukan hasil AI sungguhan). ' : `Dibuat ${dateId(shown.report.created_at)}${shown.report.model ? ` dengan ${shown.report.model}` : ''}. `}
                  {!ai && state.cached && !state.cached.fresh ? 'Data sudah berubah sejak itu, jadi buat analisa baru untuk angka terbaru.' : ''}
                </p>
                <ReportView report={shown.report} />
              </>
            ) : <p className="note" style={{ margin: 0 }}>Belum ada analisa AI untuk bulan ini.</p>}
            <button className="save" style={{ width: '100%', marginTop: 12 }} disabled={!!busy || (ai?.remaining ?? state.remaining) <= 0} onClick={() => generate(false)}>
              {busy === 'ai' ? 'Menyusun analisa…' : shown ? 'Buat analisa AI baru' : 'Buat analisa AI'}
            </button>
            {(ai?.remaining ?? state.remaining) <= 0 && <p className="note">Batas analisa AI hari ini sudah tercapai. Besok bisa lagi.</p>}
            <button className="lnk" style={{ marginLeft: 0, marginTop: 8 }} disabled={!!busy} onClick={() => consent(false)}>Cabut izin AI</button>
          </>
        )}
        <Err msg={err} />
      </section>
    </div>
  );
}
