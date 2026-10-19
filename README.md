# 親友線上德州撲克錦標賽

在瀏覽器裡跟親朋好友同桌打一場約 60 分鐘的無限注德州撲克錦標賽。不需註冊，輸入暱稱、分享 6 碼房間代碼就能開打。

- 前端：React + Vite + Tailwind CSS v4（手機直式為主，桌機也能玩）
- 後端：Node.js + Socket.IO，**伺服器權威**：洗牌、發牌、合法動作判斷、結算都在伺服器
- 語言：TypeScript（前後端共用型別放在 `shared/`）
- 測試：Vitest

## 本機啟動

需要 Node.js 20 以上。

```bash
npm install
npm run dev          # 伺服器 :3001 + 前端 :5173，改程式會自動重新載入
```

打開 http://localhost:5173 → 建立房間 → 複製邀請連結。
同一個瀏覽器會被當成同一位玩家，自己測試多人時請用「一般視窗 + 無痕視窗」或不同瀏覽器。
同一個 Wi-Fi 的朋友可以用 `http://<你電腦的區網 IP>:5173` 加入。

### 測試

```bash
npm test             # 遊戲引擎單元測試
npm run typecheck    # TypeScript 型別檢查
```

模擬一整場錦標賽（4 位模擬玩家 + 2 位電腦玩家，含斷線重連、重新進場、不合法動作）：

```bash
TIME_SCALE=12 npx tsx server/index.ts   # 終端機 1：錦標賽時鐘加速 12 倍
npm run simulate                        # 終端機 2
```

`TIME_SCALE` 也可以拿來實際玩：例如 `TIME_SCALE=10`，幾分鐘內就能看完盲注升級、時間上限等完整流程。畫面上方會顯示「測試模式」。

## 部署到 Render

repo 裡已經有 `render.yaml`。在 Render 選 **New → Blueprint**，連到這個 GitHub repo 即可。
之後每次 push 到 `main`，Render 會先跑單元測試，通過才部署。

- Build：`npm ci && npm test && npm run build`
- Start：`npm start`
- 免費方案閒置約 15 分鐘會休眠，打開時要等 30～60 秒；開賽前先自己點開喚醒。
- 房間狀態存在記憶體，伺服器重啟或重新部署會清空進行中的比賽。比賽進行中請不要 push。

Railway 等其他平台也可以：Build 用 `npm ci && npm run build`、Start 用 `npm start`，平台會用環境變數 `PORT` 指定埠號。

## 錦標賽規則

| 項目 | 規則 |
|---|---|
| 起始籌碼 | 10,000 |
| 盲注 | 1:100/200、2:150/300、3:200/400、4 起 BB ante（大盲位代付，金額＝大盲）… 12:4000/8000，之後每級 ×1.5 |
| 升級 | 依時鐘，在**下一手開始時**生效 |
| 重新進場 | 第 1～3 級被淘汰、且目前仍在第 3 級內，可用 10,000 重新進場一次 |
| 時間上限 | 決勝模式：到達上限立刻跳兩級，之後每 2 分鐘再跳兩級；或依籌碼排名：打完當手結束 |
| 名次 | 越晚淘汰越前；同一手淘汰時開局籌碼多者在前，相同則並列 |
| 計時 | 行動 25 秒，用完扣時間銀行（整場 60 秒），再用完自動過牌／棄牌 |
| 離席／斷線 | 照付盲注，輪到時立即自動過牌或棄牌 |

房主可在大廳調整：每級時間（4～15 分）、行動計時、時間銀行、是否允許重新進場、時間上限與處理方式。

### 自動行動與其他細節

- 單挑時莊家放小盲，翻牌前先行動、翻牌後最後行動
- 最小下注一個大盲；最小加注額＝本輪上一次完整加注的差額；不足額全下不會重開加注權
- 盲注或前注付不起時以剩餘籌碼全下（大盲先付大盲再付前注）
- 主池／邊池依投入金額分層，沒人跟的下注會退回
- 平分底池的零頭給莊家左邊最近的贏家
- 只剩一人未棄牌時直接贏得底池，可選擇亮牌

## 程式結構

```
shared/                     前後端共用
  types.ts                  型別、預設設定、Socket 事件
  blinds.ts                 盲注表
  handEvaluator.ts          7 選 5 牌型判斷
server/
  engine/                   純函式遊戲引擎（不碰網路與計時器）
    hand.ts                 開局、合法動作、下注輪、推進街道、攤牌結算
    pots.ts                 主池／邊池分層、平分與零頭
    tournament.ts           級別時鐘、時間上限、名次、重新進場資格
    deck.ts                 crypto.randomInt 的 Fisher–Yates 洗牌
    *.test.ts               單元測試
  room.ts                   房間生命週期、計時器、時間銀行、電腦玩家
  view.ts                   依玩家身分遮蔽資料（別人的底牌、未翻的公牌永不送出）
  describe.ts               引擎事件 → 手牌紀錄文字與籌碼動畫
  index.ts                  Express + Socket.IO
src/
  App.tsx                   首頁 → 房間大廳 → 牌桌 → 最終排名
  hooks/useRoom.ts          連線、playerToken（localStorage）、自動重連
  components/               牌桌、座位、行動區、資訊列、側欄…
scripts/simulate.ts         整場錦標賽模擬
```

### Socket 事件

| 方向 | 事件 | 說明 |
|---|---|---|
| → | `join` | `{ code?, name, avatar, token }`，不給 code 即建立新房間 |
| → | `updateSettings` / `addBot` / `removeBot` / `start` | 房主在大廳使用 |
| → | `act` | `{ type: fold｜check｜call｜bet｜raise｜allin, amount? }`，amount 為「下注到」的總額 |
| → | `rebuy` / `setAway` / `showCards` | |
| ← | `state` | 該玩家視角的完整畫面 + 新的籌碼動畫事件 |
