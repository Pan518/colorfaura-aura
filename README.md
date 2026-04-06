# colorfaura — 氣場攝影解析報告

客戶拍完氣場照後，掃 QR Code 上傳照片，自動產出專屬能量分析報告。

## 維護說明

### 改解讀文字
打開 `js/aura-data.js`，找到你要改的顏色（如 `red:`），直接修改裡面的中文即可。

### 改樣式
打開 `css/style.css`，修改 CSS 變數或樣式。

### 本地測試
```bash
npx serve .
```
然後打開 http://localhost:3000

### 部署
推到 GitHub 後，Vercel 會自動重新部署。

## 檔案結構
```
index.html        ← 主頁面
css/style.css     ← 所有樣式
js/aura-data.js   ← 氣場解讀資料（改文字在這）
js/color-engine.js← 顏色萃取引擎
js/charts.js      ← 圖表生成
js/app.js         ← 主程式流程
assets/           ← Logo 等素材
```
