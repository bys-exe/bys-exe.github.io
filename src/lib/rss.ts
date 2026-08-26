import { getCollection, render } from "astro:content";
import type { CollectionEntry } from "astro:content";
import { experimental_AstroContainer as AstroContainer } from "astro/container";

const escapeXml = (str: string) =>
    str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

async function renderContent(
    post: CollectionEntry<"blog">,
    base: string,
    container: AstroContainer,
): Promise<string> {
    const { Content } = await render(post);
    const html = await container.renderToString(Content);
    return html.replace(/(src|href)="\//g, `$1="${base}/`);
}

export async function generateRss(
    base: string,
    feedPath = "/index.xml",
): Promise<string> {
    const posts = (await getCollection("blog")).sort(
        (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
    );

    const container = await AstroContainer.create();

    const items = [];
    for (const post of posts) {
        const link = `${base}/blog/${post.id}`;
        const content = await renderContent(post, base, container);
        items.push(
            [
                "    <item>",
                `      <title>${escapeXml(post.data.title)}</title>`,
                `      <link>${link}</link>`,
                `      <guid>${link}</guid>`,
                `      <pubDate>${post.data.pubDate.toUTCString()}</pubDate>`,
                `      <description>${escapeXml(post.data.description)}</description>`,
                `      <content:encoded><![CDATA[${content}]]></content:encoded>`,
                "    </item>",
            ].join("\n"),
        );
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Yuga Sai - Blog</title>
    <link>${base}/blog</link>
    <description>Blog posts by Yuga Sai</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${base}${feedPath}" rel="self" type="application/rss+xml"/>
    <image>
      <url>${base}/images/pfp.jpg</url>
      <title>Yuga Sai - Blog</title>
      <link>${base}/blog</link>
    </image>
${items.join("\n")}
  </channel>
</rss>
`;
}
