import { useEffect, useMemo, useState } from "react";
import { MemberAttendance, searchMemberAttendance } from "../api";

type SearchMemberPanelProps = {
  onNotify: (message: string) => void;
};

export const SearchMemberPanel = ({ onNotify }: SearchMemberPanelProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberAttendance[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setStatus("loading");
      try {
        const data = await searchMemberAttendance(query, controller.signal);
        setResults(data);
        setStatus("idle");
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          return;
        }
        setStatus("error");
        onNotify("Unable to load member attendance. Try again.");
      }
    }, 450);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query, onNotify]);

  const summary = useMemo(() => {
    if (!results.length) {
      return "No attendance records to display.";
    }
    const present = results.filter((item) => item.status.toLowerCase() === "present");
    return `${present.length} present, ${results.length - present.length} absent`;
  }, [results]);

  return (
    <section className="section">
      <h2>Search by Member Name</h2>
      <p className="hint">
        Type two or more characters to filter reflected attendance history.
      </p>
      <input
        className="input-field"
        placeholder="Member name"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p className="hint">{status === "loading" ? "Searching…" : summary}</p>
      <div className="table-container">
        <table aria-label="Member attendance results">
          <thead>
            <tr>
              <th>Event Date</th>
              <th>Event Name</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((att, index) => (
              <tr key={`${att.eventDate}-${att.eventName}-${index}`}>
                <td>{att.eventDate}</td>
                <td>{att.eventName}</td>
                <td>
                  <span
                    className={`status-pill ${att.status.toLowerCase() === "present" ? "present" : "absent"}`}
                  >
                    {att.status}
                  </span>
                </td>
              </tr>
            ))}
            {!results.length && (
              <tr>
                <td colSpan={3} className="hint">
                  {status === "loading"
                    ? "Loading matches…"
                    : "No matching attendance yet. Scan an event to populate data."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

