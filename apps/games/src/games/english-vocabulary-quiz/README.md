# English Vocabulary Quiz Game

英文の意味を表す **英単語を4択で答えるクイズゲーム** です。
1プレイにつき10問出題され、最後にスコアが表示されます。

Next.js を Cloudflare Workers 上で動かすことを前提にした
**シンプル・静的構成** のサンプルプロジェクトです。

---

## 🎮 Features

- 英文を読んで意味に合う **英単語を4択で選択**
- 1回のプレイで **10問**
- 最終画面で **スコア表示**
- 問題データは **ソースにハードコード（JSON形式）**
- 各問題は **一意なID** を持つ
- DB / 認証なし（完全フロントエンド）

---

## 🧱 Tech Stack

- **Next.js (App Router)**
- **TypeScript**
- **Cloudflare Workers**

---

## 📘 Question Data Format

問題は `src/data/questions.ts` に定義します。

```ts
export type Question = {
  id: string;
  sentence: string;
  choices: string[];
  answer: string;
};

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    sentence: "She gave up her job to start her own business.",
    choices: ["quit", "hire", "train", "borrow"],
    answer: "quit",
  },
];
```

🚀 Getting Started

1. Install dependencies

```bash
Copy code
npm install
```

2. Run locally

```bash
Copy code
npm run dev
```

3. Build for Cloudflare Pages

```bash
Copy code
npm run build
```
