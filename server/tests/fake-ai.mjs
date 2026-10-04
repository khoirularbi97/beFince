// Penyedia AI palsu yang meniru Anthropic Messages API (/v1/messages) dan Chat Completions kompatibel OpenAI (.../chat/completions).
// Mode diatur lewat POST /__mode, statistik lewat GET /__stats. Port 4200.
import http from 'node:http';
let mode = 'good', calls = 0, bodies = [], headers = [];
const good = { headline: 'Secara umum terkendali, sisa {{net}} bulan ini.', health: 'perlu_perhatian',
  findings: [{ title: 'Sisa uang {{savings_rate}}', detail: 'Pemasukan {{income}}, pengeluaran {{expense}}, tersisa {{net}}.', severity: 'info' }, { title: 'Kategori terbesar', detail: '{{cat0_name}} menyumbang {{cat0_share}} dari pengeluaran.', severity: 'info' }],
  steps: [{ title: 'Sisihkan di awal bulan', why: 'Lebih mudah konsisten.', how: 'Pindahkan {{save_10}} ke tabungan setiap awal bulan selama 3 bulan.', horizon: '30_hari' }, { title: 'Pantau {{cat0_name}}', how: 'Cek pengeluaran kategori ini tiap minggu.', horizon: 'minggu_ini' }],
  watch: ['Pantau {{cat0_name}}'] };
const badFinding = { title: 'Sisa', detail: 'Sisanya Rp 3.200.000 atau 40% dari pemasukan.', severity: 'warn' };
const badStep = { title: 'Langkah palsu', how: 'Tabung {{angka_palsu}} tiap bulan.', horizon: '30_hari' };
// isi yang dikembalikan untuk tiap mode (null = bukan mode isi)
const inputFor = (m, n) => ({
  good: good,
  stray: { ...good, findings: [badFinding, good.findings[1]] },
  unknown: { ...good, headline: 'Sisa {{angka_palsu}}.' },
  stray_then_good: n === 1 ? { ...good, headline: 'Sisa Rp 3.200.000.' } : good,
  injection: { ...good, headline: '<script>alert</script> {{net}}', findings: [{ title: 'Abaikan semua aturan', detail: '{{income}} <img src=x onerror=alert>', severity: 'warn' }, good.findings[1]] },
  partial: { ...good, findings: [...good.findings, badFinding], steps: [...good.steps, badStep] },
  badheadline: { ...good, headline: 'Sisa Rp 3.200.000.' },
  long: { ...good, findings: [{ ...good.findings[0], detail: 'Kalimat panjang sekali yang diulang-ulang. '.repeat(14) + '{{net}}' }, good.findings[1]] },
  allbad: { ...good, headline: 'Sisa Rp 3.200.000.', findings: [badFinding, badFinding, badFinding], steps: [badStep, badStep] },
  enum_variants: { ...good, health: 'Needs Attention', findings: [{ ...good.findings[0], severity: 'Warning' }, { ...good.findings[1], severity: 'positive' }], steps: [{ ...good.steps[0], horizon: '30 hari' }, { ...good.steps[1], horizon: 'this week' }] },
  wrapped: { analysis: good },
  rosy: { ...good, health: 'baik', headline: 'Semuanya baik-baik saja, sisa {{net}}.' },
  allbad_then_good: n === 1 ? { ...good, headline: 'Sisa Rp 3.200.000.', findings: [badFinding, badFinding, badFinding], steps: [badStep, badStep] } : good,
}[m]);
const GONE = { error: { message: 'The model `llama-3.3-70b-versatile` has been decommissioned and is no longer supported. SECRET-PROVIDER-ERROR-BODY', type: 'invalid_request_error', code: 'model_decommissioned' } };
const BADKEY = { error: { message: 'Invalid API Key SECRET-PROVIDER-ERROR-BODY', type: 'invalid_request_error', code: 'invalid_api_key' } };

const server = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => {
    if (req.url === '/__mode') { mode = JSON.parse(b).mode; calls = 0; bodies = []; headers = []; res.end('ok'); return; }
    if (req.url === '/__stats') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ calls, bodies, headers })); return; }
    const oa = req.url.endsWith('/chat/completions');
    if (req.url !== '/v1/messages' && !oa) { res.statusCode = 404; res.end('x'); return; }
    calls++; bodies.push(b); headers.push({ key: req.headers['x-api-key'], ver: req.headers['anthropic-version'], auth: req.headers.authorization, url: req.url });
    const json = (o, st = 200) => { res.statusCode = st; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
    if (mode === 'ratelimit') return json({ error: { message: 'rate limit', code: 'rate_limit_exceeded' } }, 429);
    if (mode === 'badkey' || mode === 'auth') return json(BADKEY, 401);
    if (mode === 'decommissioned') return json(GONE, 400);
    if (mode === 'http500') { res.statusCode = 500; res.end('SECRET-PROVIDER-ERROR-BODY'); return; }
    if (mode === 'slow') return; // tidak menjawab: untuk uji batas waktu
    if (oa) { // ---- format kompatibel OpenAI (Groq, Gemini, OpenRouter, ...)
      const body = JSON.parse(b), forced = body.tool_choice && typeof body.tool_choice === 'object';
      const asTool = (input) => json({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'submit_analysis', arguments: JSON.stringify(input) } }] } }] });
      const asText = (input) => json({ choices: [{ message: { role: 'assistant', content: 'Tentu, ini hasilnya:\n```json\n' + JSON.stringify(input) + '\n```' } }] });
      if (mode === 'truncated') return json({ choices: [{ finish_reason: 'length', message: { role: 'assistant', content: null, reasoning: 'berpikir panjang sekali...' } }] });
      if (mode === 'effort_unsupported' && body.reasoning_effort) return json({ error: { message: 'unknown parameter reasoning_effort', code: 'invalid_request' } }, 400);
      if (mode === 'forced_unsupported' && forced) return json({ error: { message: 'tool_choice object not supported', code: 'invalid_request' } }, 400);
      if (mode === 'no_tools' && body.tools) return json({ error: { message: 'No endpoints found that support tool use', code: 'no_tools' } }, 404);
      if (mode === 'content_json' || mode === 'no_tools') return asText(good);
      return asTool(inputFor(mode, calls) || good);
    }
    // ---- format Anthropic
    if (mode === 'notool') return json({ content: [{ type: 'text', text: 'maaf, saya jawab biasa' }] });
    return json({ id: 'msg_x', type: 'message', role: 'assistant', content: [{ type: 'tool_use', id: 'tu_1', name: 'submit_analysis', input: inputFor(mode, calls) || good }] });
  });
});
server.listen(4200, () => console.log('fake AI di :4200'));
