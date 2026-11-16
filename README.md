# 輔英科技大學 - 營養教學平台 (雲端網頁版)

本平台為輔英科技大學保健營養系專屬之互動式教學競賽系統，支援學生手機前台即時作答與授課教師雲端後台全盤掌控。

---

## 🌟 系統特色
- **免裝軟體**：全網頁架構，支援任何手機、平板、筆電與教室大螢幕。
- **前台（學生端）**：
  - 支援學生即時連線登入、自訂暱稱與頭像。
  - 自動分組（紅、藍、黃、綠、紫、粉小隊）或個人競賽模式。
  - 即時答題、倒數計時、語音朗讀、特效與得分統計。
- **後台（教師端）**：
  - 教師專屬雲端控制面板（`/admin.html`）。
  - 一鍵切換關卡、公布答案、鎖定作答、全班重置。
  - 即時查看各題得票長條圖、百分比與 Top 5 榮譽榜。

---

## 🚀 本機快速啟動
1. 確認電腦已安裝 **Python 3.8+**。
2. 於專案目錄執行：
   ```bash
   python server.py
   ```
3. 瀏覽器開啟：
   - 學生前台：`http://localhost:8080/index.html`
   - 教師後台：`http://localhost:8080/admin.html`

---

## ☁️ 雲端免費一鍵部署指南 (Render.com)

1. 將本專案上傳至您的 **GitHub Repository**。
2. 前往 [Render.com](https://render.com/) 免費註冊並登入。
3. 點擊 **New +** ➔ 選擇 **Web Service**。
4. 連接您的 GitHub 專案。
5. 設定如下（或由 `render.yaml` 自動偵測）：
   - **Environment**: `Python`
   - **Build Command**: `pip install -r requirements.txt` (或留空)
   - **Start Command**: `python server.py`
6. 點擊 **Deploy**，約 1~2 分鐘即可獲得全球專屬網址（例如：`https://your-app.onrender.com`）！
