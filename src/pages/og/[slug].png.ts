import type { APIRoute } from "astro";
import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs/promises";
import path from "node:path";

export async function getStaticPaths() {
    const posts = await getCollection("blog");
    return posts.map((post) => ({
        params: { slug: post.id },
        props: { post },
    }));
}

interface Assets {
    fonts: {
        name: string;
        data: ArrayBuffer;
        weight: 400 | 700;
        style: "normal";
    }[];
    pfp: string;
    chibi: string;
    dots: string;
}

let assetsPromise: Promise<Assets> | null = null;

function toArrayBuffer(buf: Buffer): ArrayBuffer {
    return buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
}

function loadAssets(): Promise<Assets> {
    if (!assetsPromise) {
        const root = process.cwd();
        assetsPromise = Promise.all([
            fs.readFile(
                path.join(root, "src/assets/fonts/JetBrainsMono-Regular.ttf"),
            ),
            fs.readFile(
                path.join(root, "src/assets/fonts/JetBrainsMono-Bold.ttf"),
            ),
            fs.readFile(path.join(root, "public/images/pfp.jpg")),
            fs.readFile(
                path.join(root, "public/images/popup-chibi-tumbling.png"),
            ),
        ]).then(([regular, bold, pfp, chibi]) => {
            const dotsSvg =
                '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">' +
                '<defs><pattern id="p" width="32" height="32" patternUnits="userSpaceOnUse">' +
                '<circle cx="1" cy="1" r="1" fill="#242437"/></pattern></defs>' +
                '<rect width="1200" height="630" fill="url(#p)"/></svg>';

            return {
                fonts: [
                    {
                        name: "JetBrains Mono",
                        data: toArrayBuffer(regular),
                        weight: 400 as const,
                        style: "normal" as const,
                    },
                    {
                        name: "JetBrains Mono",
                        data: toArrayBuffer(bold),
                        weight: 700 as const,
                        style: "normal" as const,
                    },
                ],
                pfp: `data:image/jpeg;base64,${pfp.toString("base64")}`,
                chibi: `data:image/png;base64,${chibi.toString("base64")}`,
                dots: `data:image/svg+xml;base64,${Buffer.from(dotsSvg).toString("base64")}`,
            };
        });
    }
    return assetsPromise;
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

export const GET: APIRoute = async ({ props }) => {
    const post = props.post as CollectionEntry<"blog">;
    const { fonts, pfp, chibi, dots } = await loadAssets();

    const words = (post.body ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
    const readTime = Math.max(1, Math.round(words / 200));
    const date = post.data.pubDate
        .toLocaleDateString("en-US", { month: "short", year: "numeric" })
        .toUpperCase();

    const title = escapeHtml(post.data.title);
    const description = escapeHtml(post.data.description);
    const titleSize =
        title.length > 110
            ? 36
            : title.length > 80
              ? 42
              : title.length > 55
                ? 50
                : title.length > 35
                  ? 58
                  : 68;

    const markup = html`
        <div
            style="position:relative; display:flex; width:1200px; height:630px; background-color:#1e1e2e; font-family:'JetBrains Mono'; overflow:hidden;"
        >
            <img
                src="${dots}"
                style="position:absolute; top:0; left:0; width:1200px; height:630px;"
            />

            <div
                style="position:absolute; top:64px; left:80px; right:80px; display:flex; align-items:center; justify-content:space-between;"
            >
                <div style="display:flex; align-items:center;">
                    <img
                        src="${pfp}"
                        style="width:46px; height:46px; border-radius:50%; border:2px solid #585b70; object-fit:cover;"
                    />
                    <div
                        style="margin-left:14px; display:flex; font-size:26px; font-weight:700; color:#cdd6f4;"
                    >
                        yuga
                    </div>
                </div>
                <div style="display:flex; font-size:22px; color:#6c7086;">
                    bys-exe.github.io
                </div>
            </div>

            <div
                style="position:absolute; top:158px; left:80px; width:880px; display:flex; flex-direction:column;"
            >
                <div
                    style="display:flex; align-items:center; font-size:19px; letter-spacing:3px;"
                >
                    <span style="color:#cba6f7;">${date}</span>
                    <span style="margin-left:14px; color:#6c7086;"
                        >· ${readTime} MIN READ</span
                    >
                </div>
                <div
                    style="display:flex; margin-top:18px; font-size:${titleSize}px; line-height:1.15; font-weight:700; color:#cdd6f4;"
                >
                    ${title}
                </div>
                <div
                    style="display:flex; margin-top:22px; font-size:27px; line-height:1.45; color:#a6adc8;"
                >
                    ${description}
                </div>
            </div>

            <div
                style="position:absolute; left:80px; bottom:60px; display:flex; align-items:center;"
            >
                <div
                    style="display:flex; font-size:22px; font-weight:400; color:#cdd6f4;"
                >
                    Batchu yuga sai
                </div>
                <div
                    style="display:flex; margin-left:16px; font-size:22px; color:#6c7086;"
                >
                    · computer science student · developer
                </div>
            </div>

            <img
                src="${chibi}"
                style="position:absolute; right:80px; bottom:46px; width:140px;"
            />

            <div
                style="position:absolute; left:0; bottom:0; width:1200px; height:5px; background-color:#cba6f7;"
            ></div>
        </div>
    `;

    const svg = await satori(markup as Parameters<typeof satori>[0], {
        width: 1200,
        height: 630,
        fonts,
    });

    const png = new Resvg(svg, {
        fitTo: { mode: "width", value: 1200 },
    })
        .render()
        .asPng();

    return new Response(new Uint8Array(png), {
        headers: { "Content-Type": "image/png" },
    });
};
