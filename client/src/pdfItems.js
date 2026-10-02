// Mengubah isi teks halaman pdf.js menjadi daftar potongan teks berkoordinat (y dihitung dari atas halaman).
// Dipisah dari pdfText.js supaya bisa diuji di Node tanpa Vite.
export async function pagesFromDoc(doc) {
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items
      .filter((it) => typeof it.str === 'string' && it.str.trim() !== '')
      .map((it) => ({ str: it.str, x: it.transform[4], y: vp.height - it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) || 8 }));
    pages.push({ items, width: vp.width, height: vp.height });
  }
  return pages;
}
