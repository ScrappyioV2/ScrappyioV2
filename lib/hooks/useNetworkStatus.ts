import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    const conn = (navigator as any).connection;
    if (conn) {
      const checkSpeed = () => {
        setIsSlow(conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || conn.downlink < 1);
      };
      checkSpeed();
      conn.addEventListener('change', checkSpeed);
      return () => {
        conn.removeEventListener('change', checkSpeed);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, isSlow };
}
