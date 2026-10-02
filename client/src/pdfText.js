// Membaca teks PDF di browser dengan pdf.js (dimuat hanya saat ada PDF yang dipilih, supaya aplikasi tetap ringan).
import { pagesFromDoc } from './pdfItems';

const MAX_PAGES = 60;

export async function extractPages(buffer) {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  try {
    if (doc.numPages > MAX_PAGES) throw new Error(`PDF terlalu panjang (maksimal ${MAX_PAGES} halaman). Bagi per bulan.`);
    return await pagesFromDoc(doc);
  } finally {
    doc.destroy();
  }
}
