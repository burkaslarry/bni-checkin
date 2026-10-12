let pendingRequestCount = 0;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

/**
 * [F011][S1101] Global API Loading
 * Registers one API request and returns an idempotent completion callback so parallel calls share one dialog.
 */
export function beginApiRequest(): () => void {
  pendingRequestCount += 1;
  emitChange();
  let completed = false;
  return () => {
    if (completed) return;
    completed = true;
    pendingRequestCount = Math.max(0, pendingRequestCount - 1);
    emitChange();
  };
}

export function subscribeApiLoading(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getApiLoadingSnapshot(): boolean {
  return pendingRequestCount > 0;
}
