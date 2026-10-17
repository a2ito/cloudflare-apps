import { NextRequest, NextResponse } from "next/server";
import { checkOutboundUrl } from "@/lib/outbound-url";

interface OgpData {
  title?: string;
  type?: string;
  image?: string;
  ogpDescription?: string;
  siteName?: string;
  locale?: string;
  url?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "URL parameter is required" },
      { status: 400 },
    );
  }

  const checked = checkOutboundUrl(url);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.reason }, { status: 400 });
  }

  try {
    const response = await fetchFollowingSafeRedirects(checked.url);
    if (response === null) {
      return NextResponse.json(
        { error: "Redirected to a URL that is not allowed" },
        { status: 400 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status}` },
        { status: response.status },
      );
    }

    const html = await response.text();
    const ogpData: OgpData = {};

    // Extract OGP meta tags
    const titleMatch = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    );
    if (titleMatch) ogpData.title = titleMatch[1];

    const typeMatch = html.match(
      /<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']+)["']/i,
    );
    if (typeMatch) ogpData.type = typeMatch[1];

    const imageMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    );
    if (imageMatch) ogpData.image = imageMatch[1];

    const descriptionMatch = html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    );
    if (descriptionMatch) ogpData.ogpDescription = descriptionMatch[1];

    const siteNameMatch = html.match(
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    );
    if (siteNameMatch) ogpData.siteName = siteNameMatch[1];

    const localeMatch = html.match(
      /<meta[^>]+property=["']og:locale["'][^>]+content=["']([^"']+)["']/i,
    );
    if (localeMatch) ogpData.locale = localeMatch[1];

    const urlMatch = html.match(
      /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
    );
    if (urlMatch) ogpData.url = urlMatch[1];

    // If no OGP data found, also try to extract basic title and description from HTML
    if (Object.keys(ogpData).length === 0) {
      const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleTagMatch) ogpData.title = titleTagMatch[1];

      const descriptionMetaMatch = html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      );
      if (descriptionMetaMatch)
        ogpData.ogpDescription = descriptionMetaMatch[1];
    }

    return NextResponse.json(ogpData);
  } catch (error) {
    console.error("Error fetching OGP data:", error);
    return NextResponse.json(
      { error: "Failed to fetch or parse the URL" },
      { status: 500 },
    );
  }
}

const MAX_REDIRECTS = 5;

/**
 * リダイレクトは自動で追わず、行き先を 1 回ずつ確かめてから追う。
 * 公開ページから内部向けのアドレスへ飛ばして制限をすり抜けるのを防ぐ。
 * 許していない行き先へ飛ばされたら null を返す
 */
async function fetchFollowingSafeRedirects(
  start: URL,
): Promise<Response | null> {
  let current = start;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const response = await fetch(current, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OGP-Checker/1.0)",
      },
      redirect: "manual",
    });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location) {
      return response;
    }
    const next = checkOutboundUrl(new URL(location, current).toString());
    if (!next.ok) return null;
    current = next.url;
  }
  return null;
}
