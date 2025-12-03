import { useCallback, useEffect, useState } from "react";
import { recordAttendance } from "../api";

type PendingScan = {
  id: string;
  qrPayload: string;
  createdAt: string;
};

const QUEUE_KEY = "anchor-checkin-queue";

const loadQueue = (): PendingScan[] => {
  if (typeof window === "undefined") {
    return [];
  }
  const stored = window.localStorage.getItem(QUEUE_KEY);
  if (!stored) {
    return [];
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    window.localStorage.removeItem(QUEUE_KEY);
  }
  return [];
};

const persistQueue = (queue: PendingScan[]) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

const createPendingScan = (qrPayload: string): PendingScan => ({
  id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
  qrPayload,
  createdAt: new Date().toISOString()
});

export const useOfflineQueue = () => {
  const [queue, setQueue] = useState<PendingScan[]>(() => loadQueue());

  const enqueue = useCallback(
    (qrPayload: string) => {
      const next = [...loadQueue(), createPendingScan(qrPayload)];
      setQueue(next);
      persistQueue(next);
    },
    []
  );

  const flushQueue = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.onLine) {
      return { flushed: 0 };
    }
    const stored = loadQueue();
    if (!stored.length) {
      return { flushed: 0 };
    }
    const remaining: PendingScan[] = [];
    let flushed = 0;
    for (const item of stored) {
      try {
        await recordAttendance(item.qrPayload);
        flushed += 1;
      } catch {
        remaining.push(item);
      }
    }
    setQueue(remaining);
    persistQueue(remaining);
    return { flushed };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (navigator.onLine && queue.length) {
      void flushQueue();
    }
    const handleOnline = () => {
      void flushQueue();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushQueue, queue.length]);

  return {
    pendingCount: queue.length,
    enqueue,
    flushQueue
  };
};

