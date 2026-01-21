/**
 * Seating Dashboard Component
 * Advanced version with analytics, history, and export capabilities
 */

import { useState, useCallback } from "react";
import type { Guest, Member, MatchResult, TableGroup } from "../types/seating";

type SeatingDashboardProps = {
  matchResult: (MatchResult & { provider?: string }) | null;
  members: Member[];
  currentGuest: Guest | null;
  onClearMatch: () => void;
};

type MatchHistory = {
  id: string;
  timestamp: string;
  guest: Guest;
  result: MatchResult & { provider?: string };
};

export const SeatingDashboard = ({
  matchResult,
  members,
  currentGuest,
  onClearMatch,
}: SeatingDashboardProps) => {
  const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Group members by table
  const getTableGroups = useCallback((): TableGroup[] => {
    const map = new Map<number, Member[]>();
    for (const member of members) {
      const list = map.get(member.tableNumber) ?? [];
      list.push(member);
      map.set(member.tableNumber, list);
    }
    return [...map.entries()]
      .map(([tableNumber, tableMembers]) => ({
        tableNumber,
        members: tableMembers,
      }))
      .sort((a, b) => a.tableNumber - b.tableNumber);
  }, [members]);

  // Record match in history
  const recordMatch = useCallback(() => {
    if (matchResult && currentGuest) {
      setMatchHistory((prev) => [
        ...prev,
        {
          id: `match-${Date.now()}`,
          timestamp: new Date().toLocaleString(),
          guest: currentGuest,
          result: matchResult,
        },
      ]);
    }
  }, [matchResult, currentGuest]);

  // Export history as CSV
  const exportHistoryAsCSV = useCallback(() => {
    const headers = [
      "Timestamp",
      "Guest Name",
      "Guest Profession",
      "Target Profession",
      "Assigned Table",
      "Match Strength",
      "Provider",
    ];
    const rows = matchHistory.map((m) => [
      m.timestamp,
      m.guest.name,
      m.guest.profession,
      m.guest.targetProfession,
      m.result.assignedTableNumber ?? "Unassigned",
      m.result.matchStrength,
      m.result.provider ?? "unknown",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seating-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [matchHistory]);

  const tableGroups = getTableGroups();
  const assignedTable = matchResult?.assignedTableNumber;
  const strength = matchResult?.matchStrength ?? "Low";

  const strengthColorMap: Record<string, string> = {
    High: "#22c55e",
    Medium: "#fb923c",
    Low: "#ef4444",
  };

  const strengthColor = strengthColorMap[strength] || "#94a3b8";

  return (
    <div className="seating-dashboard">
      {/* Match Confirmation */}
      {matchResult && currentGuest && (
        <div className="match-confirmation" style={{ borderLeftColor: strengthColor }}>
          <div className="confirmation-content">
            <div className="confirmation-header">
              <h3>✓ Seating Assignment Confirmed</h3>
              <button
                className="close-button"
                onClick={() => {
                  onClearMatch();
                  recordMatch();
                }}
                title="Close and record match"
              >
                ✓
              </button>
            </div>
            <div className="confirmation-details">
              <div className="detail-item">
                <span className="label">Guest:</span>
                <span className="value">{currentGuest.name}</span>
              </div>
              <div className="detail-item">
                <span className="label">Profession:</span>
                <span className="value">{currentGuest.profession}</span>
              </div>
              <div className="detail-item">
                <span className="label">Target:</span>
                <span className="value">{currentGuest.targetProfession}</span>
              </div>
              <div className="detail-item">
                <span className="label">Assigned Table:</span>
                <span
                  className="value table-number"
                  style={{ backgroundColor: strengthColor }}
                >
                  {assignedTable ?? "Unassigned"}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Match Quality:</span>
                <span className="value" style={{ color: strengthColor }}>
                  {strength}
                </span>
              </div>
            </div>
            <div className="match-note-section">
              <h4>Why this table?</h4>
              <p>{matchResult.matchNote}</p>
            </div>
            <div className="alternative-tables">
              <h4>Alternative Options:</h4>
              <ul className="alternatives-list">
                {matchResult.rankedTables.slice(0, 3).map((table) => (
                  <li key={table.tableNumber} className="alternative-item">
                    <span className="table-no">Table {table.tableNumber}</span>
                    <span className="strength">{table.matchStrength}</span>
                    <span className="reason">{table.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Seating Chart */}
      <div className="seating-chart-container">
        <div className="chart-header">
          <h3>📋 Seating Arrangement</h3>
          <div className="chart-controls">
            <button
              className="control-button"
              onClick={() => setShowHistory(!showHistory)}
              title="View match history"
            >
              📊 History ({matchHistory.length})
            </button>
            {matchHistory.length > 0 && (
              <button
                className="control-button"
                onClick={exportHistoryAsCSV}
                title="Export history as CSV"
              >
                💾 Export
              </button>
            )}
          </div>
        </div>

        {/* History View */}
        {showHistory && matchHistory.length > 0 && (
          <div className="history-panel">
            <h4>Recent Assignments</h4>
            <div className="history-list">
              {matchHistory.slice().reverse().map((match) => (
                <div key={match.id} className="history-item">
                  <span className="history-time">{match.timestamp}</span>
                  <span className="history-guest">
                    {match.guest.name} ({match.guest.profession})
                  </span>
                  <span className="history-table">
                    → Table {match.result.assignedTableNumber}
                  </span>
                  <span
                    className="history-strength"
                    style={{
                      backgroundColor: strengthColorMap[match.result.matchStrength],
                    }}
                  >
                    {match.result.matchStrength}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tables Grid */}
        <div className="tables-grid-enhanced">
          {tableGroups.map((table) => {
            const isAssignedTable = assignedTable === table.tableNumber;
            return (
              <div
                key={table.tableNumber}
                className={`table-card-enhanced ${isAssignedTable ? "assigned" : ""}`}
                style={{
                  borderColor: isAssignedTable ? strengthColor : undefined,
                  boxShadow: isAssignedTable
                    ? `0 0 15px ${strengthColor}80`
                    : undefined,
                }}
              >
                <div className="table-card-header">
                  <h4>Table {table.tableNumber}</h4>
                  <div className="table-meta">
                    <span className="seat-badge">
                      {table.members.length}/8
                    </span>
                    {isAssignedTable && (
                      <span
                        className="assigned-badge"
                        style={{ backgroundColor: strengthColor }}
                      >
                        NEW GUEST
                      </span>
                    )}
                  </div>
                </div>

                <ul className="enhanced-member-list">
                  {table.members.map((member) => (
                    <li key={member.id} className="enhanced-member-item">
                      <div className="member-avatar">
                        {member.name.charAt(0)}
                      </div>
                      <div className="member-details">
                        <div className="member-name">{member.name}</div>
                        <div className="member-profession">
                          {member.profession}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {isAssignedTable && currentGuest && (
                  <div className="potential-connections">
                    <h5>🤝 Key Connections</h5>
                    <ul className="connections-list">
                      {table.members.slice(0, 2).map((member) => (
                        <li key={member.id} className="connection-item">
                          <span className="profession-tag">
                            {member.profession}
                          </span>
                          {currentGuest.bottlenecks.some((bn) =>
                            member.profession.toLowerCase().includes(bn.toLowerCase())
                          ) && (
                            <span className="bottleneck-match" title="Can help with bottleneck">
                              ✓ Problem Solver
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Capacity Overview */}
      <div className="capacity-overview">
        <h4>📊 Table Capacity Overview</h4>
        <div className="capacity-bars">
          {tableGroups.map((table) => {
            const occupancy = (table.members.length / 8) * 100;
            const statusColor =
              occupancy >= 100
                ? "#ef4444"
                : occupancy >= 75
                  ? "#fb923c"
                  : "#22c55e";
            return (
              <div key={table.tableNumber} className="capacity-bar-item">
                <span className="table-label">Table {table.tableNumber}</span>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(occupancy, 100)}%`,
                      backgroundColor: statusColor,
                    }}
                  />
                </div>
                <span className="capacity-text">
                  {table.members.length}/8
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
