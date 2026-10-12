import { useSyncExternalStore } from "react";
import { getApiLoadingSnapshot, subscribeApiLoading } from "../lib/apiLoading";

/** Global progress dialog driven by all requests made through fetchWithTimeout. */
export function ApiLoadingDialog() {
  const loading = useSyncExternalStore(subscribeApiLoading, getApiLoadingSnapshot, () => false);
  if (!loading) return null;

  return (
    <div className="api-loading-overlay" role="dialog" aria-modal="true" aria-label="處理中">
      <div className="api-loading-dialog">
        <span className="api-loading-spinner" aria-hidden="true" />
        <span>處理中，請稍候…</span>
      </div>
    </div>
  );
}
