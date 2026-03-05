import { useState, useEffect } from 'react';

const API = '/api';

export function useBadge() {
  const [unread, setUnread] = useState(0);

  const fetch_count = () => {
    fetch(`${API}/notifications/unread/count`)
      .then(r => r.json())
      .then(d => setUnread(d.count || 0))
      .catch(() => {});
  };

  useEffect(() => {
    fetch_count();
    const interval = setInterval(fetch_count, 15000);
    return () => clearInterval(interval);
  }, []);

  return { unread, refresh: fetch_count };
}
