import { useEffect, useState } from 'react';

export function useApi<T>(url: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch(url)
      .then(async (r) => {
        if (r.status === 401) {
          location.href = '/sign-in';
          return;
        }
        const body = (await r.json()) as { data?: T; error?: { message: string } };
        if (!r.ok) throw new Error(body.error?.message);
        if (active) setData(body.data);
      })
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [url]);
  return { data, error, loading, setData };
}
