import { useEffect, useState } from "react";
import { EventAttendance, searchEventAttendance } from "../api";

type SearchEventPanelProps = {
  onNotify: (message: string) => void;
};

export const SearchEventPanel = ({ onNotify }: SearchEventPanelProps) => {
  const [date, setDate] = useState("");
  const [results, setResults] = useState<EventAttendance[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!date) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    void (async () => {
      try {
        const data = await searchEventAttendance(date, controller.signal);
        setResults(data);
        setStatus("idle");
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          return;
        }
        setStatus("error");
        onNotify("Unable to load event attendees. Please retry.");
      }
    })();
    return () => {
      controller.abort();
    };
  }, [date, onNotify]);

  return (
    <section className="section">
      <h2>Search by Event Date</h2>
      <p className="hint">
        Pick a date to review attendance per member for that event.
      </p>
      <input
        className="input-field"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />
      <p className="hint">{status === "loading" ? "Loading attendees…" : `${results.length} attendees`}</p>
      <div className="table-container">
        <table aria-label="Event attendance list">
          <thead>
            <tr>
              <th>Member Name</th>
              <th>Membership ID</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((att, index) => (
              <tr key={`${att.memberName}-${att.membershipId ?? index}`}>
                <td>{att.memberName}</td>
                <td>{att.membershipId || "—"}</td>
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
                    ? "Loading attendees…"
                    : "Select a date to show event results."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

