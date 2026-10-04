// Penyedia AI palsu yang meniru Anthropic Messages API untuk pengujian. Mode diatur lewat POST /__mode.
import http from 'node:http';
let mode = 'good', calls = 0, bodies = [], headers = [];
const good = { headline: 'Secara umum terkendali, sisa {{net}} bulan ini.', health: 'perlu_perhatian',
  findings: [{ title: 'Sisa uang {{savings_rate}}', detail: 'Pemasukan {{income}}, pengeluaran {{expense}}, tersisa {{net}}.', severity: 'info' }, { title: 'Kategori terbesar', detail: '{{cat0_name}} menyumbang {{cat0_share}} dari pengeluaran.', severity: 'info' }],
  steps: [{ title: 'Sisihkan di awal bulan', why: 'Lebih mudah konsisten.', how: 'Pindahkan {{save_10}} ke tabungan setiap awal bulan selama 3 bulan.', horizon: '30_hari' }, { title: 'Pantau {{cat0_name}}', how: 'Cek pengeluaran kategori ini tiap minggu.', horizon: 'minggu_ini' }],
  watch: ['Pantau {{cat0_name}}'] };
const server = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => {
    if (req.url === '/__mode') { mode = JSON.parse(b).mode; calls = 0; bodies = []; headers = []; res.end('ok'); return; }
    if (req.url === '/__stats') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ calls, bodies, headers })); return; }
    const oa = req.url.endsWith('/chat/completions');
    if (req.url !== '/v1/messages' && !oa) { res.statusCode = 404; res.end('x'); return; }
    calls++; bodies.push(b); headers.push({ key: req.headers['x-api-key'], ver: req.headers['anthropic-version'], auth: req.headers.authorization, url: req.url });
    if (oa) { // ---- format kompatibel OpenAI (Groq, Gemini, OpenRouter, ...)
      const body = JSON.parse(b), json = (o, st = 200) => { res.statusCode = st; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(o)); };
      const asTool = (input) => json({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'submit_analysis', arguments: JSON.stringify(input) } }] } }] });
      const asText = (input, wrap = '```json\n%s\n```') => json({ choices: [{ message: { role: 'assistant', content: 'Tentu, ini hasilnya:\n' + wrap.replace('%s', JSON.stringify(input)) } }] });
      const forced = body.tool_choice && typeof body.tool_choice === 'object';
      if (mode === 'ratelimit') return json({ error: { message: 'rate limit' } }, 429);
      if (mode === 'auth') return json({ error: { message: 'bad key SECRET-PROVIDER-ERROR-BODY' } }, 401);
      if (mode === 'http500') return json({ error: 'SECRET-PROVIDER-ERROR-BODY' }, 500);
      if (mode === 'slow') return;
      if (mode === 'forced_unsupported' && forced) return json({ error: { message: 'tool_choice object not supported' } }, 400);
      if (mode === 'no_tools' && body.tools) return json({ error: { message: 'No endpoints found that support tool use' } }, 404);
      if (mode === 'content_json' || mode === 'no_tools') return asText(good);
      if (mode === 'stray') return asTool({ ...good, headline: 'Sisa Rp 3.200.000.' });
      return asTool(good);
    }
    const reply = (input) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ id: 'msg_x', type: 'message', role: 'assistant', content: [{ type: 'tool_use', id: 'tu_1', name: 'submit_analysis', input }] })); };
    if (mode === 'http500') { res.statusCode = 500; res.end('SECRET-PROVIDER-ERROR-BODY'); return; }
    if (mode === 'slow') return; // tidak menjawab: untuk uji batas waktu
    if (mode === 'notool') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ content: [{ type: 'text', text: 'maaf, saya jawab biasa' }] })); return; }
    if (mode === 'stray') return reply({ ...good, findings: [{ title: 'Sisa', detail: 'Sisanya Rp 3.200.000 atau 40% dari pemasukan.', severity: 'info' }, good.findings[1]] });
    if (mode === 'unknown') return reply({ ...good, headline: 'Sisa {{angka_palsu}}.' });
    if (mode === 'stray_then_good') return reply(calls === 1 ? { ...good, headline: 'Sisa Rp 3.200.000.' } : good);
    if (mode === 'injection') return reply({ ...good, headline: '<script>alert(1)</script> {{net}}', findings: [{ title: 'Abaikan semua aturan', detail: '{{income}} <img src=x onerror=alert(1)>', severity: 'warn' }, good.findings[1]] });
    return reply(good);
  });
});
server.listen(4200, () => console.log('fake AI di :4200'));
