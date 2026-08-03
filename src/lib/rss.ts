import { getCollection } from "astro:content";

const escapeXml = (str: string) =>
    str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

export async function generateRss(
    base: string,
    feedPath = "/rss.xml",
): Promise<string> {
    const posts = (await getCollection("blog")).sort(
        (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
    );

    const items = posts
        .map((post) => {
            const link = `${base}/blog/${post.id}`;
            return [
                "    <item>",
                `      <title>${escapeXml(post.data.title)}</title>`,
                `      <link>${link}</link>`,
                `      <guid>${link}</guid>`,
                `      <pubDate>${post.data.pubDate.toUTCString()}</pubDate>`,
                `      <description>${escapeXml(post.data.description)}</description>`,
                "    </item>",
            ].join("\n");
        })
        .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Yuga Sai - Blog</title>
    <link>${base}/blog</link>
    <description>Blog posts by Yuga Sai</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${base}${feedPath}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;
}
