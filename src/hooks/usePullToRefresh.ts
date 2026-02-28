import { useEffect, useRef, useState } from 'react';
import WebApp from '@twa-dev/sdk';

export function usePullToRefresh(onRefresh: () => Promise<void> | void, enabled: boolean) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const onStart = (e: TouchEvent) => {
      if (refreshing) return;
      if ((window.scrollY || document.documentElement.scrollTop || 0) > 0) return;
      startY.current = e.touches?.[0]?.clientY ?? null;
      armed.current = false;
      setPull(0);
    };

    const onMove = (e: TouchEvent) => {
      if (refreshing) return;
      if (startY.current == null) return;
      const y = e.touches?.[0]?.clientY ?? 0;
      const dy = y - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      const dist = Math.min(110, dy);
      setPull(dist);
      if (!armed.current && dist > 60) {
        armed.current = true;
        try {
          WebApp?.HapticFeedback?.impactOccurred?.('light');
        } catch {
        }
      }
    };

    const onEnd = async () => {
      if (startY.current == null) return;
      const shouldRefresh = armed.current;
      startY.current = null;
      armed.current = false;
      if (!shouldRefresh) {
        setPull(0);
        return;
      }
      setRefreshing(true);
      setPull(60);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, onRefresh, refreshing]);

  return { pull, refreshing, armed: pull > 60 };
}

