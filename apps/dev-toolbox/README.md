# Dev Toolbox

Dev Toolbox is a web-based utility site for IT engineers, built with **Next.js** and **Cloudflare Workers**.

It provides a collection of small, fast, and privacy-friendly tools such as password generation, Unix time conversion, JSON formatting, and more — all accessible from a clean admin-style interface.

---

## ✨ Features

- 🧰 **Engineer Utilities**
  - Password Generator
  - Unix Time Converter
  - JSON Formatter
  - SQL Formatter
  - Regex Tester
  - JWT Decoder
  - Base64 Tool
  - Scratchpad
  - Markdown Scratchpad
  - URL Encoder/Decoder
  - Cron Expression Tester
  - Keypair Generator
  - OGP Checker

- 🌍 **Internationalization (i18n)**
  - Language-aware routing (`/en`, `/ja`)
  - Automatic locale detection via browser settings

- 🌙 **Dark Mode**
  - Fully supported via Tailwind CSS
  - Manual toggle + system preference

- 🧱 **Admin-style UI**
  - Sidebar-based layout
  - Tools can be added or removed easily

- ⚡ **Edge-first Architecture**
  - Runs on Cloudflare Workers
  - Minimal server-side processing

- 🔍 **SEO-friendly**
  - Dynamic metadata per tool
  - Open Graph / canonical / alternates support

---

## 🛠 Tech Stack

- **Framework**: Next.js (App Router)
- **Runtime**: Cloudflare Workers
- **Styling**: Tailwind CSS
- **Language**: TypeScript (strict)
- **i18n**: Custom lightweight implementation

---

## 📁 Project Structure (Simplified)

```
src/
├─ app/
│  ├─ [lang]/
│  │  ├─ tools/
│  │  │  ├─ [slug]/
│  │  │  └─ layout.tsx
│  │  └─ page.tsx
│  └─ layout.tsx
│
├─ components/
│  ├─ admin/
│  └─ tools/
│
├─ i18n/
│  ├─ messages/
│  └─ config.ts
│
├─ tools/
│  ├─ config.ts
│  └─ types.ts
│
├─ lib/
│  └─ getAvailableTools.ts
│
└─ middleware.ts
```

---

## ➕ Adding a New Tool

1. **Define the tool slug**
   - Add it to `src/tools/config.ts`

2. **Add translations**
   - Update `src/i18n/messages/ja.ts` and `en.ts`

3. **Create the UI**
   - Add a React component under `src/components/tools/`
   - Add a route under `app/[lang]/tools/[slug]/`

TypeScript will guide you if anything is missing.

---

## 🚀 Development

```bash
npm install
npm run dev
```

---

## ☁️ Deployment (Cloudflare Workers)

main への push で Workers Builds が `npm run cf:build` / `npm run cf:deploy` を流す（[vinext](https://vinext.dev)）。
Worker の設定は `cloudflare.config.ts`。

---

## 📌 Philosophy

- Small, focused tools
- No unnecessary backend logic
- Strong type safety
- Easy to extend
- Fast at the edge

---

## 📄 License

MIT License
