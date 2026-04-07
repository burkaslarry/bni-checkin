# 如何產生使用者手冊 PDF（繁體中文）

本專案提供兩種方式取得 **繁體中文使用者手冊 PDF**：

---

## 方式一：由 HTML 列印成 PDF（建議）

1. 用瀏覽器開啟：
   ```
   docs/USER_MANUAL_TC.html
   ```
   或在專案根目錄執行：
   ```bash
   open docs/USER_MANUAL_TC.html
   ```
2. 在瀏覽器選單選擇 **列印**（或 `Cmd+P` / `Ctrl+P`）
3. 目的地選擇 **「儲存為 PDF」** 或 **「另存為 PDF」**
4. 儲存檔案即可

---

## 方式二：由 Markdown 轉 PDF（需安裝工具）

若已安裝 [Node.js](https://nodejs.org/)：

```bash
npx md-to-pdf docs/USER_MANUAL_TC.md --pdf-options '{"format": "A4", "margin": "20mm"}'
```

產生的 PDF 會出現在 `docs/USER_MANUAL_TC.pdf`。

若使用 [pandoc](https://pandoc.org/)：

```bash
pandoc docs/USER_MANUAL_TC.md -o docs/USER_MANUAL_TC.pdf --pdf-engine=xelatex -V mainfont="PingFang TC"
```

---

## 檔案說明

| 檔案 | 說明 |
|------|------|
| `docs/USER_MANUAL_TC.md` | 手冊原文（Markdown，繁體中文） |
| `docs/USER_MANUAL_TC.html` | 手冊 HTML 版，適合用瀏覽器「列印 → 儲存為 PDF」 |
