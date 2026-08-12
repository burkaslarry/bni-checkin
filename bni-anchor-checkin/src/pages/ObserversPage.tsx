import { Navigate } from "react-router-dom";
import { ClientAuthGate } from "../components/ClientAuthGate";
import { useChapter } from "../chapterContext";

/** Legacy route — observer management lives under bulk import. */
export default function ObserversPage() {
  return (
    <ClientAuthGate>
      <ObserversRedirect />
    </ClientAuthGate>
  );
}

function ObserversRedirect() {
  const { adminHref } = useChapter();
  const base = adminHref("/admin/import");
  const url = new URL(base, "http://local");
  url.searchParams.set("type", "observer");
  url.hash = "observer-management";
  return <Navigate to={`${url.pathname}${url.search}${url.hash}`} replace />;
}
