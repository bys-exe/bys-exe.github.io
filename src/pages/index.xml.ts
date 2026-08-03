import type { APIRoute } from "astro";
import { generateRss } from "../lib/rss";

export const GET: APIRoute = async ({ site }) => {
    const base = (
        site ?? new URL("https://bys-exe.github.io")
    ).toString().replace(/\/$/, "");

    return new Response(await generateRss(base, "/index.xml"), {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
        },
    });
};
