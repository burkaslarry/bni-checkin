import { useState, useCallback, useEffect } from "react";
import type { Guest, Member, MatchResult } from "../types/seating";
import { matchGuestWithMembers } from "../lib/assignGuestToTable";
import { sampleGuests } from "../lib/sampleData";
import { getMembers } from "../api";

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

    setIsMatching(true);
    setCurrentGuest(guest);
    try {
      const result = await matchGuestWithMembers(guest, members);
      setMatchResult(result);
      onNotify(
        `配對完成！${result.provider === "keyword" ? "使用關鍵字配對" : `使用 ${result.provider?.toUpperCase()} AI 配對`}`,
        "success"
      );
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

      {/* Guest Input Form */}
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

      {/* Match Result Summary */}
      {matchResult && currentGuest && (
        <div className="match-result-card">
          <div className="result-header">
            <h3>配對結果 Match Result</h3>
            <span className={strengthStyles[matchResult.matchStrength]}>
              {matchResult.matchStrength} Match
            </span>
          </div>
          <div className="result-content">
            <div className="result-note">{matchResult.matchNote}</div>
          </div>
        </div>
      )}

      {/* Recommended Member Combinations */}
      {matchResult && matchResult.recommendedMembers && matchResult.recommendedMembers.length > 0 && (
        <div className="matched-members-section">
          <div className="section-header">
            <h3>💼 推薦配對組合 Recommended Combinations</h3>
            <p className="hint">
              {currentGuest?.name} ({currentGuest?.profession}) 可以同以下會員配對交流：
            </p>
          </div>

          <div className="member-combinations-list">
            {matchResult.recommendedMembers.map((memberMatch, index) => (
              <div
                key={memberMatch.member.id}
                className="combination-card"
              >
                <div className="combination-header">
                  <div className="combination-number">#{index + 1}</div>
                  <div className="member-info-header">
                    <h4 className="member-name">{memberMatch.member.name}</h4>
                    <span className={strengthStyles[memberMatch.matchStrength]}>
                      {memberMatch.matchStrength} Match
                    </span>
                  </div>
                </div>
                
                <div className="member-profession">
                  {memberMatch.member.profession}
                </div>

                <div className="match-reason">
                  <strong>配對原因：</strong>
                  <p>{memberMatch.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration Info */}
      <div className="config-info">
        <h4>⚙️ API 配置說明</h4>
        <p className="hint">
          請在專案根目錄建立 <code>.env.local</code> 檔案並添加以下環境變數：
        </p>
        <div className="config-example">
          <code>
            VITE_DEEPSEEK_API_KEY=your_deepseek_key<br />
            VITE_DEEPSEEK_MODEL=deepseek-v3<br />
            VITE_GEMINI_API_KEY=your_gemini_key
          </code>
        </div>
        <p className="hint">
          系統會優先使用 DeepSeek AI，失敗時自動切換至 Gemini，兩者都失敗則使用關鍵字匹配。
        </p>
      </div>
    </section>
  );
};
