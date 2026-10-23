# Number Logic

数独をベースにしたロジックパズルゲームです。Next.js App Router と Cloudflare Workers 上で動作し、ブラウザだけでプレイできます。

---

## 🇯🇵 日本語

### 概要

**Number Logic** は、数独ルールをベースにしたブラウザ向けロジックパズルゲームです。

- 問題は自動生成
- 難易度選択（Easy / Normal / Hard）
- 常に **唯一解** を保証
- タイムアタック形式
- 難易度別ハイスコアを localStorage に保存
- ダークモード / ライトモード切り替え対応

### 使用技術

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Cloudflare Workers
- localStorage（ハイスコア保存）

### 機能一覧

- トップ画面

  - 難易度プルダウン選択
  - Start Game ボタン
  - 難易度別ハイスコア表示
  - ダークモード切り替え

- ゲーム画面

  - 数独問題の自動生成
  - 唯一解保証（バックトラッキングによる解数検証）
  - タイマー計測
  - ゲームクリア時メッセージ表示
  - ハイスコア更新判定

### ディレクトリ構成（抜粋）

```
app/
├─ layout.tsx        # テーマ初期化（dark class）
├─ page.tsx          # トップページ
└─ game/
   ├─ page.tsx       # Suspense ラッパー（Server Component）
   └─ GameClient.tsx # ゲーム本体（Client Component）
```

### 開発・起動方法

```bash
npm install
npm run dev
```

Cloudflare Workers へデプロイする場合は、`@cloudflare/next-on-pages` を利用してください。

### 今後の拡張アイデア

- ヒント機能
- URL seed による問題共有
- デイリーチャレンジ
- 難易度別ランキング（上位 N 件）
- 効果音・演出強化

---

## 🇺🇸 English

### Overview

**Number Logic** is a browser-based logic puzzle game inspired by Sudoku.
It runs on **Next.js App Router** and **Cloudflare Workers**, and requires no backend server.

### Features

- Automatically generated Sudoku puzzles
- Difficulty selection (Easy / Normal / Hard)
- Guaranteed **unique solution** for every puzzle
- Time-based gameplay
- High scores saved per difficulty using localStorage
- Dark mode / Light mode toggle

### Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Cloudflare Workers
- localStorage (for high score persistence)

### Gameplay

- Select difficulty on the home screen
- Start a new game
- Solve the puzzle as fast as possible
- On clear:

  - Your time is recorded
  - High score is updated if it’s a new record

### Project Structure (excerpt)

```
app/
├─ layout.tsx        # Theme initialization (dark class)
├─ page.tsx          # Home page
└─ game/
   ├─ page.tsx       # Suspense wrapper (Server Component)
   └─ GameClient.tsx # Main game logic (Client Component)
```

### Development

```bash
npm install
npm run dev
```

To deploy on Cloudflare Workers, use `@cloudflare/next-on-pages`.

### Puzzle Generation Logic

1. Generate a fully solved Sudoku grid
2. Remove numbers randomly
3. After each removal, count the number of solutions
4. Keep the removal **only if exactly one solution remains**

This guarantees every puzzle has a unique solution.

### Future Improvements

- Hint system based on logical solving steps
- Shareable puzzles using URL seeds
- Daily challenge mode
- Leaderboards per difficulty
- Sound effects and animations

---

Enjoy solving puzzles with **Number Logic** 🧩
