import { useState, useCallback, useEffect, useRef } from "react";
import type { Guest, Member, MatchResult, MemberMatch } from "../types/seating";
import { sampleGuests } from "../lib/sampleData";
import { getMembers, batchMatch, BatchGuestInfo, BatchMatchResult } from "../api";

type StrategicPlanningPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
  eventId?: number;
};

const strengthStyles: Record<MatchResult["matchStrength"], string> = {
  High: "strength-badge high",
  Medium: "strength-badge medium",
  Low: "strength-badge low",
};

export const StrategicPlanningPanel = ({ onNotify, eventId }: StrategicPlanningPanelProps) => {
  // Guest form state
  const [guestName, setGuestName] = useState("");
  const [guestProfession, setGuestProfession] = useState("");
  const [guestTargetProfession, setGuestTargetProfession] = useState("");
  const [guestBottlenecks, setGuestBottlenecks] = useState("");
  const [guestRemarks, setGuestRemarks] = useState("");

  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  // Match result state
  const [matchResult, setMatchResult] = useState<(MatchResult & { provider?: "deepseek" | "gemini" | "keyword" | null }) | null>(null);
  const [currentGuest, setCurrentGuest] = useState<Guest | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  // Batch matching state
  const [showBatchMode, setShowBatchMode] = useState(false);
  const [batchGuests, setBatchGuests] = useState<BatchGuestInfo[]>([]);
  const [batchResults, setBatchResults] = useState<BatchMatchResult[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load real members from backend
  useEffect(() => {
    const loadMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const data = await getMembers();
        
        // Convert MemberInfo[] to Member[]
        const convertedMembers: Member[] = data.members.map((memberInfo, index) => ({
          id: `member-${index}`,
          name: memberInfo.name,
          profession: memberInfo.domain,
        }));
        
        setMembers(convertedMembers);
      } catch (error) {
        onNotify("無法載入會員名單", "error");
        setMembers([]);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    loadMembers();
  }, [onNotify]);

  const handleMatch = async () => {
    // Improved validation with specific field checks (Target Profession is now optional)
    setShowValidation(true);
    const missingFields: string[] = [];
    if (!guestName.trim()) missingFields.push("姓名 Name");
    if (!guestProfession.trim()) missingFields.push("職業 Profession");
    
    if (missingFields.length > 0) {
      onNotify(`請填寫以下欄位: ${missingFields.join(", ")}`, "error");
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const guest: Guest = {
      id: `guest-${Date.now()}`,
      name: guestName.trim(),
      profession: guestProfession.trim(),
      targetProfession: guestTargetProfession.trim() || undefined,
      bottlenecks: guestBottlenecks
        .split(",")
        .map((b) => b.trim())
        .filter((b) => b.length > 0),
      remarks: guestRemarks.trim() || undefined,
    };

    // Clear previous result before starting new match
    setMatchResult(null);
    setIsMatching(true);
    setCurrentGuest(guest);
    try {
      // Use batchMatch API (same as 批量配對) - calls DeepSeek
      const response = await batchMatch([{
        name: guest.name,
        profession: guest.profession,
        remarks: guest.remarks
      }]);
      const batchResult = response.results[0];
      if (!batchResult) {
        throw new Error("No match result returned");
      }
      const recommendedMembers: MemberMatch[] = batchResult.matchedMembers.map((m) => ({
        member: {
          id: `member-${m.memberName}`,
          name: m.memberName,
          profession: m.profession
        },
        matchStrength: (m.matchStrength as "High" | "Medium" | "Low") || "Low",
        reason: m.reason
      }));
      const highCount = recommendedMembers.filter((m) => m.matchStrength === "High").length;
      const mediumCount = recommendedMembers.filter((m) => m.matchStrength === "Medium").length;
      let overallMatchStrength: "High" | "Medium" | "Low" = "Low";
      if (highCount >= 2) overallMatchStrength = "High";
      else if (highCount >= 1 || mediumCount >= 3) overallMatchStrength = "Medium";
      const result: MatchResult & { provider?: "deepseek" | "gemini" | "keyword" | null } = {
        matchStrength: overallMatchStrength,
        matchNote: `${response.provider === "deepseek" ? "🤖 DeepSeek AI" : "🤖 AI"}: 找到 ${recommendedMembers.length} 位推薦會員`,
        recommendedMembers,
        provider: response.provider === "deepseek" ? "deepseek" : "keyword"
      };
      setMatchResult(result);
      onNotify(`配對完成！使用 ${response.provider?.toUpperCase()} AI 配對。CSV 已下載`, "success");
      // Auto-download CSV (batching_single-{name}.csv), stay on page
      const safeName = guest.name.replace(/[/\\?%*:|"<>]/g, "_");
      exportBatchResultsCsvFromResults([batchResult], `batching_single-${safeName}.csv`);
    } catch (error) {
      onNotify(
        "配對失敗: " + (error instanceof Error ? error.message : "未知錯誤"),
        "error"
      );
    } finally {
      setIsMatching(false);
    }
  };

  const handleLoadSampleGuest = () => {
    const sample = sampleGuests[Math.floor(Math.random() * sampleGuests.length)];
    setGuestName(sample.name);
    setGuestProfession(sample.profession);
    setGuestTargetProfession(sample.targetProfession || "");
    setGuestBottlenecks(sample.bottlenecks.join(", "));
    setGuestRemarks(sample.remarks || "");
    setMatchResult(null);
    setShowValidation(false);
    onNotify("已載入範例來賓資料", "info");
  };

  const handleReset = () => {
    setGuestName("");
    setGuestProfession("");
    setGuestTargetProfession("");
    setGuestBottlenecks("");
    setGuestRemarks("");
    setMatchResult(null);
    setCurrentGuest(null);
    setShowValidation(false);
    onNotify("已重置表單", "info");
  };

  // Batch matching functions
  // Download CSV template
  const downloadCsvTemplate = () => {
    const template = '\ufeff姓名(Name),專業領域(Profession),引薦人(Referrer),備註(Remarks)\n張三,網頁設計,Larry Lo,有意加入BNI\n李四,會計服務,Jessica Cheung,';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'batch_matching_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify("CSV 範本已下載", "success");
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header line
      const dataLines = lines.slice(1);
      const guests: BatchGuestInfo[] = [];
      
      for (const line of dataLines) {
        // Handle CSV with possible quoted values
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length >= 2 && parts[0] && parts[1]) {
          guests.push({
            name: parts[0],
            profession: parts[1],
            remarks: parts[3] || parts[2] || undefined // Column 4 is remarks, column 3 is referrer
          });
        }
      }
      
      if (guests.length === 0) {
        onNotify("CSV 檔案格式不正確，請確保包含姓名和專業領域欄位", "error");
        return;
      }
      
      setBatchGuests(guests);
      setBatchResults([]);
      onNotify(`已載入 ${guests.length} 位來賓資料`, "success");
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // State for loading dialog
  const [showLoadingDialog, setShowLoadingDialog] = useState(false);

  const handleBatchMatch = async () => {
    if (batchGuests.length === 0) {
      onNotify("請先上傳 CSV 檔案", "error");
      return;
    }

    setIsBatchProcessing(true);
    setShowLoadingDialog(true);
    setBatchProgress(0);
    setBatchResults([]);

    try {
      const response = await batchMatch(batchGuests);
      setBatchResults(response.results);
      setShowLoadingDialog(false);
      onNotify(`批量配對完成！已處理 ${response.results.length} 位來賓`, "success");
      
      // Auto-export CSV on success
      if (response.results.length > 0) {
        setTimeout(() => {
          exportBatchResultsCsvFromResults(response.results);
        }, 500);
      }
    } catch (error) {
      setShowLoadingDialog(false);
      onNotify("批量配對失敗: " + (error instanceof Error ? error.message : "未知錯誤"), "error");
    } finally {
      setIsBatchProcessing(false);
      setBatchProgress(100);
    }
  };

  // Export function that takes results as parameter (for auto-export)
  // Optional filename: e.g. "batching_single-張三.csv" for single guest
  const exportBatchResultsCsvFromResults = (results: BatchMatchResult[], customFilename?: string) => {
    const csvLines: string[] = [];
    csvLines.push("姓名(Name),專業領域(Profession),可配對會友,理由");

    for (const result of results) {
      // Sort matches: High first, then Medium, then Low
      const sortedMatches = [...result.matchedMembers].sort((a, b) => {
        const order = { High: 0, Medium: 1, Low: 2 };
        return (order[a.matchStrength as keyof typeof order] || 2) - (order[b.matchStrength as keyof typeof order] || 2);
      });

      if (sortedMatches.length > 0) {
        // Get the best match(es)
        const bestStrength = sortedMatches[0].matchStrength;
        const bestMatches = sortedMatches.filter(m => m.matchStrength === bestStrength);
        
        const matchedNames = bestMatches.map(m => `${m.memberName}(${m.profession})`).join('; ');
        const reasons = bestMatches.map(m => m.reason).join('; ');
        
        // Escape CSV values
        const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
        
        csvLines.push([
          escapeCsv(result.guestName),
          escapeCsv(result.guestProfession),
          escapeCsv(matchedNames),
          escapeCsv(reasons)
        ].join(','));
      } else {
        csvLines.push([
          `"${result.guestName}"`,
          `"${result.guestProfession}"`,
          '"無匹配"',
          '"未找到合適的配對會員"'
        ].join(','));
      }
    }

    const csvContent = '\ufeff' + csvLines.join('\n'); // Add BOM for Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = customFilename ?? `batch_matching_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    onNotify("CSV 結果已自動匯出", "success");
  };

  const exportBatchResultsCsv = () => {
    if (batchResults.length === 0) {
      onNotify("沒有可匯出的結果", "error");
      return;
    }

    const csvLines: string[] = [];
    csvLines.push("姓名(Name),專業領域(Profession),可配對會友,理由");

    for (const result of batchResults) {
      // Sort matches: High first, then Medium, then Low
      const sortedMatches = [...result.matchedMembers].sort((a, b) => {
        const order = { High: 0, Medium: 1, Low: 2 };
        return (order[a.matchStrength as keyof typeof order] || 2) - (order[b.matchStrength as keyof typeof order] || 2);
      });

      if (sortedMatches.length > 0) {
        // Get the best match(es)
        const bestStrength = sortedMatches[0].matchStrength;
        const bestMatches = sortedMatches.filter(m => m.matchStrength === bestStrength);
        
        const matchedNames = bestMatches.map(m => `${m.memberName}(${m.profession})`).join('; ');
        const reasons = bestMatches.map(m => m.reason).join('; ');
        
        // Escape CSV values
        const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
        
        csvLines.push([
          escapeCsv(result.guestName),
          escapeCsv(result.guestProfession),
          escapeCsv(matchedNames),
          escapeCsv(reasons)
        ].join(','));
      } else {
        csvLines.push([
          `"${result.guestName}"`,
          `"${result.guestProfession}"`,
          '"無匹配"',
          '"未找到合適的配對會員"'
        ].join(','));
      }
    }

    const csvContent = '\ufeff' + csvLines.join('\n'); // Add BOM for Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_matching_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    onNotify("CSV 已匯出", "success");
  };

  const resetBatchMode = () => {
    setBatchGuests([]);
    setBatchResults([]);
    setBatchProgress(0);
  };

  return (
    <section className="section strategic-planning-panel">
      <div className="section-header">
        <h2>🎯 Strategic Networking Matchmaker</h2>
        <p className="hint">
          為來賓推薦最佳配對會員 {eventId && `(活動 ID: ${eventId})`}
        </p>
        {isLoadingMembers && (
          <p className="hint" style={{ color: 'var(--accent)' }}>
            ⏳ 正在載入會員資料... ({members.length} 位已載入)
          </p>
        )}
        {!isLoadingMembers && members.length > 0 && (
          <p className="hint" style={{ color: 'var(--success)' }}>
            ✓ 已載入 {members.length} 位會員資料
          </p>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="mode-toggle" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          className={`button ${!showBatchMode ? 'primary' : 'ghost-button'}`}
          onClick={() => setShowBatchMode(false)}
          style={{ flex: 1 }}
        >
          👤 單一來賓配對
        </button>
        <button
          type="button"
          className={`button ${showBatchMode ? 'primary' : 'ghost-button'}`}
          onClick={() => setShowBatchMode(true)}
          style={{ flex: 1 }}
        >
          📋 批量配對
        </button>
      </div>

      {/* Batch Matching Section */}
      {showBatchMode && (
        <div className="batch-matching-section" style={{ marginBottom: '2rem' }}>
          <div className="guest-form-card">
            <div className="form-header">
              <h3>📋 批量配對 Batch Matching</h3>
              <p className="hint">上傳 CSV 檔案進行批量 AI 配對</p>
            </div>

            <div className="csv-upload-section" style={{ padding: '1rem', border: '2px dashed var(--border)', borderRadius: '8px', marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>CSV 格式說明</h4>
              <p className="hint" style={{ marginBottom: '0.5rem' }}>
                請上傳包含以下欄位的 CSV 檔案：
              </p>
              <code style={{ display: 'block', background: 'var(--card-bg)', padding: '0.5rem', borderRadius: '4px', marginBottom: '1rem' }}>
                姓名(Name),專業領域(Profession),引薦人(Referrer),備註(Remarks)
              </code>
              
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={downloadCsvTemplate}
                  style={{ cursor: 'pointer' }}
                >
                  📥 下載 CSV 範本
                </button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  style={{ display: 'none' }}
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="button"
                  style={{ cursor: 'pointer', display: 'inline-block' }}
                >
                  📁 選擇 CSV 檔案
                </label>
              </div>
            </div>

            {batchGuests.length > 0 && (
              <div className="batch-preview" style={{ marginBottom: '1rem' }}>
                <h4>已載入 {batchGuests.length} 位來賓</h4>
                <div style={{ maxHeight: '200px', overflow: 'auto', background: 'var(--card-bg)', padding: '0.5rem', borderRadius: '4px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.25rem' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '0.25rem' }}>姓名</th>
                        <th style={{ textAlign: 'left', padding: '0.25rem' }}>專業領域</th>
                        <th style={{ textAlign: 'left', padding: '0.25rem' }}>備註</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchGuests.slice(0, 10).map((guest, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.25rem' }}>{idx + 1}</td>
                          <td style={{ padding: '0.25rem' }}>{guest.name}</td>
                          <td style={{ padding: '0.25rem' }}>{guest.profession}</td>
                          <td style={{ padding: '0.25rem' }}>{guest.remarks || '-'}</td>
                        </tr>
                      ))}
                      {batchGuests.length > 10 && (
                        <tr>
                          <td colSpan={4} style={{ padding: '0.25rem', textAlign: 'center', color: 'var(--muted)' }}>
                            ... 還有 {batchGuests.length - 10} 位
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="button primary"
                    onClick={handleBatchMatch}
                    disabled={isBatchProcessing || isLoadingMembers}
                    style={{ flex: 2 }}
                  >
                    {isBatchProcessing ? '⏳ 配對中...' : '🤖 開始 AI 批量配對'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={resetBatchMode}
                    style={{ flex: 1 }}
                  >
                    🔄 重置
                  </button>
                </div>
              </div>
            )}

            {/* Batch Results */}
            {batchResults.length > 0 && (
              <div className="batch-results" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4>配對結果 ({batchResults.length} 位來賓)</h4>
                  <button
                    type="button"
                    className="button"
                    onClick={exportBatchResultsCsv}
                  >
                    📥 匯出 CSV
                  </button>
                </div>
                
                <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                  {batchResults.map((result, idx) => {
                    const sortedMatches = [...result.matchedMembers].sort((a, b) => {
                      const order = { High: 0, Medium: 1, Low: 2 };
                      return (order[a.matchStrength as keyof typeof order] || 2) - (order[b.matchStrength as keyof typeof order] || 2);
                    });
                    
                    return (
                      <div key={idx} className="batch-result-card" style={{ 
                        background: 'var(--card-bg)', 
                        padding: '1rem', 
                        borderRadius: '8px', 
                        marginBottom: '0.5rem',
                        border: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <strong>{result.guestName}</strong>
                          <span className="hint">{result.guestProfession}</span>
                        </div>
                        {sortedMatches.length > 0 ? (
                          <div>
                            {sortedMatches.slice(0, 3).map((match, mIdx) => (
                              <div key={mIdx} style={{ 
                                padding: '0.25rem 0.5rem', 
                                background: match.matchStrength === 'High' ? 'rgba(34, 197, 94, 0.1)' : 
                                           match.matchStrength === 'Medium' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                                borderRadius: '4px',
                                marginBottom: '0.25rem',
                                fontSize: '0.9rem'
                              }}>
                                <span style={{ 
                                  color: match.matchStrength === 'High' ? 'var(--success)' : 
                                         match.matchStrength === 'Medium' ? 'var(--warning)' : 'var(--muted)'
                                }}>
                                  {match.matchStrength === 'High' ? '🔥' : match.matchStrength === 'Medium' ? '⚡' : '💡'}
                                </span>
                                {' '}{match.memberName} ({match.profession})
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="hint">無匹配</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Guest Input Form - Only show when not in batch mode */}
      {!showBatchMode && (
      <div className="guest-form-card">
        <div className="form-header">
          <h3>來賓資料 Guest Profile</h3>
          <div className="form-actions">
            <button
              type="button"
              className="ghost-button small"
              onClick={handleLoadSampleGuest}
            >
              📝 載入範例
            </button>
            <button
              type="button"
              className="ghost-button small"
              onClick={handleReset}
            >
              🔄 重置
            </button>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="guest-name">姓名 Name *</label>
            <input
              id="guest-name"
              className={`input-field ${showValidation && !guestName.trim() ? 'input-error' : ''}`}
              placeholder="例如: 劉建國"
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                if (showValidation && e.target.value.trim()) setShowValidation(false);
              }}
            />
            {showValidation && !guestName.trim() && (
              <span className="error-text">⚠️ 此欄位為必填</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="guest-profession">職業 Profession *</label>
            <input
              id="guest-profession"
              className={`input-field ${showValidation && !guestProfession.trim() ? 'input-error' : ''}`}
              placeholder="精確職稱，如：高淨值客戶財富管理師"
              value={guestProfession}
              onChange={(e) => {
                setGuestProfession(e.target.value);
                if (showValidation && e.target.value.trim()) setShowValidation(false);
              }}
            />
            {showValidation && !guestProfession.trim() && (
              <span className="error-text">⚠️ 此欄位為必填</span>
            )}
            <span className="hint" style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem', display: 'block' }}>
              💡 越具體越好！避免只寫「創業家」，改寫「餐飲連鎖創業家」
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="guest-target">目標職業 Target Profession</label>
            <input
              id="guest-target"
              className="input-field"
              placeholder="例如：房地產開發商的IT採購決策者"
              value={guestTargetProfession}
              onChange={(e) => setGuestTargetProfession(e.target.value)}
            />
            <span className="hint" style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem', display: 'block' }}>
              🎯 寫出具體對象，而非行業！如：「擁有大量企業客戶的保險經紀人」
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="guest-bottlenecks">
              瓶頸 Bottlenecks (用逗號分隔)
            </label>
            <input
              id="guest-bottlenecks"
              className="input-field"
              placeholder="例如：缺乏進入政府標案的管道"
              value={guestBottlenecks}
              onChange={(e) => setGuestBottlenecks(e.target.value)}
            />
            <span className="hint" style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem', display: 'block' }}>
              🔑 這是配對的關鍵！寫出你缺什麼、誰能幫你
            </span>
          </div>

          <div className="form-group full-width">
            <label htmlFor="guest-remarks">備註 Remarks - 價值交換</label>
            <textarea
              id="guest-remarks"
              className="input-field"
              rows={3}
              placeholder="我有[資源/專業]，我想找[目標對象]，我可以提供[給對方的價值]。例如：我有超過50位準客戶正在尋找專業律師合作，能分享家族辦公室設立趨勢。"
              value={guestRemarks}
              onChange={(e) => setGuestRemarks(e.target.value)}
            />
            <span className="hint" style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem', display: 'block' }}>
              ⭐ 最重要！說明你能給別人什麼價值，才能吸引高質量對接
            </span>
          </div>
        </div>

        <button
          type="button"
          className="button match-btn"
          onClick={handleMatch}
          disabled={isMatching || isLoadingMembers || members.length === 0}
        >
          {isLoadingMembers 
            ? "⏳ 載入會員中..." 
            : isMatching 
              ? "⏳ 配對中..." 
              : members.length === 0
                ? "❌ 無會員資料"
                : "🎯 開始配對"}
        </button>
      </div>
      )}

      {/* Match Result Summary - Only show when not in batch mode */}
      {!showBatchMode && matchResult && currentGuest && (
        <div className="match-result-card">
          <div className="result-header">
            <h3>配對結果</h3>
            <span className={strengthStyles[matchResult.matchStrength]}>
              {matchResult.matchStrength === "High" ? "高度匹配" : 
               matchResult.matchStrength === "Medium" ? "中度匹配" : "低度匹配"}
            </span>
          </div>
          <div className="result-content">
            <div className="result-note">{matchResult.matchNote}</div>
          </div>
        </div>
      )}

      {/* Recommended Member Combinations - Grouped by Match Strength - Only show when not in batch mode */}
      {!showBatchMode && matchResult && matchResult.recommendedMembers && matchResult.recommendedMembers.length > 0 && (() => {
        const highMatches = matchResult.recommendedMembers.filter(m => m.matchStrength === "High");
        const mediumMatches = matchResult.recommendedMembers.filter(m => m.matchStrength === "Medium");
        const lowMatches = matchResult.recommendedMembers.filter(m => m.matchStrength === "Low");

        return (
          <div className="matched-members-section">
            <div className="section-header">
              <h3>💼 AI 推薦配對</h3>
              <p className="hint">
                {currentGuest?.name} ({currentGuest?.profession}) 的配對建議：
              </p>
            </div>

            {/* High Match Members */}
            {highMatches.length > 0 && (
              <div className="match-strength-group">
                <div className="match-strength-header high">
                  <h4>🔥 最高匹配度 ({highMatches.length})</h4>
                  <p className="hint">強烈推薦優先交流的會員</p>
                </div>
                <div className="member-combinations-list">
                  {highMatches.map((memberMatch, index) => (
                    <div key={memberMatch.member.id} className="combination-card high-match">
                      <div className="combination-header">
                        <div className="combination-number high">#{index + 1}</div>
                        <div className="member-info-header">
                          <h4 className="member-name">{memberMatch.member.name}</h4>
                          <span className={strengthStyles[memberMatch.matchStrength]}>
                            高度匹配
                          </span>
                        </div>
                      </div>
                      <div className="member-profession">{memberMatch.member.profession}</div>
                      <div className="match-reason">
                        <strong>配對原因：</strong>
                        <p>{memberMatch.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Medium Match Members */}
            {mediumMatches.length > 0 && (
              <div className="match-strength-group">
                <div className="match-strength-header medium">
                  <h4>⚡ 中度匹配 ({mediumMatches.length})</h4>
                  <p className="hint">值得考慮交流的會員</p>
                </div>
                <div className="member-combinations-list">
                  {mediumMatches.map((memberMatch, index) => (
                    <div key={memberMatch.member.id} className="combination-card medium-match">
                      <div className="combination-header">
                        <div className="combination-number medium">#{index + 1}</div>
                        <div className="member-info-header">
                          <h4 className="member-name">{memberMatch.member.name}</h4>
                          <span className={strengthStyles[memberMatch.matchStrength]}>
                            中度匹配
                          </span>
                        </div>
                      </div>
                      <div className="member-profession">{memberMatch.member.profession}</div>
                      <div className="match-reason">
                        <strong>配對原因：</strong>
                        <p>{memberMatch.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low Match Members */}
            {lowMatches.length > 0 && (
              <div className="match-strength-group">
                <div className="match-strength-header low">
                  <h4>💡 低度匹配 ({lowMatches.length})</h4>
                  <p className="hint">一般人脈拓展機會</p>
                </div>
                <div className="member-combinations-list">
                  {lowMatches.map((memberMatch, index) => (
                    <div key={memberMatch.member.id} className="combination-card low-match">
                      <div className="combination-header">
                        <div className="combination-number low">#{index + 1}</div>
                        <div className="member-info-header">
                          <h4 className="member-name">{memberMatch.member.name}</h4>
                          <span className={strengthStyles[memberMatch.matchStrength]}>
                            低度匹配
                          </span>
                        </div>
                      </div>
                      <div className="member-profession">{memberMatch.member.profession}</div>
                      <div className="match-reason">
                        <strong>配對原因：</strong>
                        <p>{memberMatch.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Configuration Info */}
      <div className="config-info">
        <h4>⚙️ API 配置說明</h4>
        <p className="hint">
          請在專案根目錄建立 <code>.env.local</code> 檔案並添加以下環境變數：
        </p>
        <p className="hint">
          系統會優先使用 DeepSeek AI，失敗時自動切換至 Gemini，兩者都失敗則使用關鍵字匹配。
        </p>
      </div>

      {/* Loading Dialog for Batch Matching */}
      {showLoadingDialog && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div 
            style={{
              background: 'var(--card-bg, #1a1a2e)',
              borderRadius: '16px',
              padding: '2rem 3rem',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              maxWidth: '450px'
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'spin 2s linear infinite' }}>
              🤖
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>AI 配對分析中...</h3>
            <p style={{ color: 'var(--muted, #888)', margin: 0 }}>
              正在使用 DeepSeek AI 為 {batchGuests.length} 位來賓進行智能配對
            </p>
            <p style={{ color: 'var(--accent, #6366f1)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              ⚡ 並行處理中（約需 1-2 分鐘）
            </p>
            <div style={{ 
              marginTop: '1.5rem', 
              height: '4px', 
              background: 'var(--border)', 
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                height: '100%', 
                background: 'var(--accent, #6366f1)',
                width: '100%',
                animation: 'loading-bar 2s ease-in-out infinite'
              }} />
            </div>
            <button
              onClick={() => {
                setShowLoadingDialog(false);
                setIsBatchProcessing(false);
                onNotify("已取消批量配對", "info");
              }}
              className="ghost-button"
              style={{ marginTop: '1.5rem', width: '100%' }}
            >
              ✕ 關閉此視窗（處理將繼續）
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </section>
  );
};
