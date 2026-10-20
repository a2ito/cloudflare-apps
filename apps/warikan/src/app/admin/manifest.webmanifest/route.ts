import { adminManifest } from "@/lib/admin-manifest";

// manifest の規約ファイル（app/manifest.ts）はアプリに 1 つしか置けないので、管理画面のぶんは Route Handler で出す。
// ブラウザは manifest をクッキー無しで取りに来るので、ここはログインを求めない（中身は公開して困るものではない）
export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(adminManifest()), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
