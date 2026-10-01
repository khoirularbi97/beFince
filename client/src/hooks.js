import { useEffect, useState } from 'react';

// Ambil data dari API; ulangi saat deps berubah. `reload()` memaksa ambil ulang.
export function useApi(fn, deps) {
  const [state, setState] = useState({ data: null, error: '' });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    fn().then((data) => alive && setState({ data, error: '' }))
      .catch((e) => alive && setState((s) => ({ ...s, error: e.message })));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...state, reload: () => setN((x) => x + 1) };
}
