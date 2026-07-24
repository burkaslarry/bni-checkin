import { useChapter } from "../chapterContext";

/** Banner when logged in as BNI Anchor. */
export function AnchorOnlyNotice() {
  const { isAnchorMode } = useChapter();
  if (!isAnchorMode) return null;

  return (
    <aside className="anchor-only-notice" role="note">
      <strong>此管理後台只應付 BNI Anchor</strong>
      <p>
        你已以 <strong>BNI Anchor</strong> 登入：會員、嘉賓、活動簽到、報表與匯入皆以 Anchor 資料為準（
        <code>chapter=anchor</code>）。
      </p>
      <p>
        若要管理其他 chapter（例如 AMax）的日常資料，請登出後以該 chapter 的 AdminLogin（如{" "}
        <code>amax</code>）重新登入。你亦可在本頁「Chapter 密碼」重設其他 chapter 的登入密碼。
      </p>
    </aside>
  );
}
