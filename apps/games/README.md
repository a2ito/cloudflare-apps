# games

https://game.a2ito.work で公開しているゲーム集。1 つの Next.js アプリ（Worker `games`）に
複数のゲームを載せ、`/<name>` で出し分ける。トップページはゲームへのリンク集。

| パス                       | ゲーム                                                       |
| -------------------------- | ------------------------------------------------------------ |
| `/klondike`                | クロンダイク（ソリティア）                                   |
| `/tetris`                  | テトリス                                                     |
| `/english-vocabulary-quiz` | 英文の意味に合う英単語を 4 択で答えるクイズ                  |
| `/ball-bounce`             | 摩擦や重力を変えながらボールを跳ねさせる物理シミュレーション |
| `/2048`                    | 同じ数字のタイルをくっつけて 2048 を目指すパズル             |
| `/minesweeper`             | マインスイーパー（初級 9×9 / 中級 16×16）                    |
| `/snake`                   | スネーク                                                     |
| `/hexspin`                 | 六角形のタイルを 3 枚ずつ回して同じ色の三角形を作るパズル    |

各ゲームの説明は `src/games/<name>/README.md` にある。もとは別々のリポジトリ・別々の
Worker だったものをまとめた。

## 構成

```
src/app/
  (portal)/                          トップページ
  (<name>)/<name>/layout.tsx         ゲームごとの root layout と globals.css
src/games/<name>/                    ゲームごとの components / lib
public/<name>/                       ゲームごとの画像や favicon
```

**ゲームごとに root layout を分けている。** `globals.css` の中身がゲームごとに違い
（klondike だけ class ベースのダークモードなど）、1 つにまとめると互いに干渉する。
root layout をまたぐ遷移はフルリロードになるが、別のゲームへ移るだけなので困らない。
トップページからのリンクが `<Link>` ではなく `<a>` なのもこのため。

**同じオリジンを全ゲームで共有する。** localStorage / sessionStorage のキーには
ゲーム名を付け、Cookie は `path` をゲームのパスに絞る。認証のあるアプリはここに入れない。
1 つの XSS が全部に及ぶため。

**サイト全体を 1 つの PWA にしている。** `src/app/manifest.ts` の scope は `/` で、
どのゲームから追加してもトップページが開く。`public/sw.js` は一度開いたページと
アセットをキャッシュし、圏外でも遊べるようにする（画面はネットワーク優先）。
klondike を開くと 52 枚のカード画像もまとめてキャッシュする。各 root layout で
`PWA_METADATA`（`src/lib/pwa.ts`）と `<ServiceWorkerRegistrar />` を入れている。
アイコンは `node scripts/gen-icons.mjs` で `public/icons/` に生成する。

## ゲームを足すとき

1. `src/app/(<name>)/<name>/` に `layout.tsx`・`page.tsx`・`globals.css` を置く。
   `layout.tsx` には `PWA_METADATA` と `<ServiceWorkerRegistrar />` を入れる
2. components や lib は `src/games/<name>/`、画像は `public/<name>/` に置く
3. `src/app/(portal)/page.tsx` の `GAMES` と `src/app/manifest.ts` の `shortcuts` に足す

## 開発

```bash
npm run dev -w apps/games
```

http://localhost:3000 がトップページ、http://localhost:3000/klondike などが各ゲーム。
