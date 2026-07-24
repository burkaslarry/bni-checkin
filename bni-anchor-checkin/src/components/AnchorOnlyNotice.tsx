import { useChapter } from "../chapterContext";

/** Banner for plain /admin* routes: this surface is BNI Anchor only. */
export function AnchorOnlyNotice() {
  const { isAnchorMode } = useChapter();
  if (!isAnchorMode) return null;

  return (
    <aside className="anchor-only-notice" role="note">
      <strong>此管理後台只應付 BNI Anchor</strong>
      <p>
        本頁（<code>/admin</code> 系列）專門服務 <strong>BNI Anchor</strong> 分會：會員、嘉賓、活動簽到、報表與匯入皆以
        Anchor 資料為準（API 預設 <code>chapter=anchor</code>）。
      </p>
      <p>
        若要管理其他 chapter（例如 AMax），請改用{" "}
        <a href="/admin?client=true">
          <code>/admin?client=true</code>
        </a>{" "}
        並以該 chapter 的 AdminLogin / AdminPassword 登入。請勿在本頁匯入或修改其他分會資料。
      </p>
    </aside>
  );
}
