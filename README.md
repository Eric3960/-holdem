# 德州撲克（React + Tailwind v4 前端 / Node + Socket.IO 伺服器）

多人線上德州撲克。伺服器負責洗牌、發牌、計時與比牌（含邊池），每位玩家只會收到自己的底牌。

## 開發

```bash
npm install
npm run dev        # 同時啟動伺服器 (3001) 與 Vite (5173)
```

開兩個瀏覽器分頁到 http://localhost:5173 ，用同一個房間代碼入座，就能互打。
每個分頁是獨立玩家；重新整理會回到原座位（30 秒內）。

## 正式執行（一個服務同時提供網頁與 WebSocket）

```bash
npm run build
npm start          # http://localhost:3001，可用環境變數 PORT 改埠號
```

- **同一個 Wi-Fi 的朋友**：讓他們開 `http://<你電腦的區網 IP>:3001`（Windows 防火牆第一次會詢問，請允許）。
- **放上網路**：部署到支援 WebSocket 的 Node 主機，例如 Render（Web Service）：
  - Build command：`npm install && npm run build`
  - Start command：`npm start`

## 結構

```
shared/                    前後端共用：常數、牌型判斷
server/
├─ index.js                Express + Socket.IO；房間管理、依玩家送出個人化畫面
└─ table.js                單桌狀態機：入座/離座、下注輪、邊池、電腦玩家、計時
src/
├─ App.jsx                 大廳 → 牌桌
├─ hooks/useSocketTable.js 連線、重連、收發狀態與籌碼動畫事件
└─ components/
   ├─ Lobby.jsx            暱稱、頭像、房間代碼、座位數
   ├─ TopBar.jsx           房號、連線燈號、邀請連結、加/減電腦玩家
   ├─ PokerTable.jsx       桌布、座位（含空位）、底池、公牌、籌碼動畫
   ├─ PlayerSeat.jsx       頭像、籌碼、Dealer、行動標籤、離線/等待中
   ├─ TurnTimer.jsx        頭像外圈倒數（依伺服器剩餘時間接續）
   ├─ HandPanel.jsx · ActionPanel.jsx · ActionLog.jsx
   └─ PlayingCard.jsx · CommunityCards.jsx · Chip.jsx · Pot.jsx · BetChips.jsx · FlyingChip.jsx
```

## Socket 事件

| 方向 | 事件 | 內容 |
|---|---|---|
| → 伺服器 | `join` | `{ room, name, avatar, seatCount, token }` |
| → 伺服器 | `act` | `{ type: 'fold' \| 'check' \| 'call' \| 'raise', amount? }`（amount 為「加注到」的總額） |
| → 伺服器 | `addBot` / `removeBot` | — |
| ← 客戶端 | `state` | 該玩家視角的牌桌狀態 + 本次新增的 `flights`（籌碼動畫） |

## 目前規則與限制

- 盲注 10/20，起始籌碼 2,000；輸光下一手自動補碼（朋友局用）
- 中途入座的人從下一手開始發牌；斷線 30 秒後自動離座，輪到斷線玩家時 1.5 秒後自動過牌/棄牌
- 房間在所有人離開 10 分鐘後關閉；狀態存在記憶體，伺服器重啟會清空
- 尚未實作：帳號、真實金流、聊天、觀戰者手動入座
