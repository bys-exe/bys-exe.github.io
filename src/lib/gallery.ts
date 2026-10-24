import { getCollection } from "astro:content";
import type { ImageMetadata } from "astro";

const imageModules = import.meta.glob(
    "../assets/gallery/**/*.{jpg,jpeg,png,webp,avif,gif,JPG,JPEG,PNG,WEBP,AVIF,GIF}",
    { eager: true, import: "default" },
) as Record<string, ImageMetadata>;

export interface GalleryPhoto {
    src: ImageMetadata;
    filename: string;
    caption: string;
    alt: string;
}

export interface GalleryAlbum {
    slug: string;
    title: string;
    description: string;
    date?: Date;
    cover: GalleryPhoto;
    photos: GalleryPhoto[];
}

function prettifyFilename(filename: string): string {
    return filename
        .replace(/\.[^.]+$/, "")
        .replace(/^\d{1,3}(?!\d)(?:[\s_-]|\.(?!\d))+/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function prettifySlug(slug: string): string {
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export async function getAlbums(): Promise<GalleryAlbum[]> {
    const entries = await getCollection("gallery");
    const entriesBySlug = new Map(entries.map((entry) => [entry.id, entry]));

    const grouped = new Map<
        string,
        {
            folder: string;
            files: { filename: string; src: ImageMetadata }[];
        }
    >();

    for (const [path, src] of Object.entries(imageModules)) {
        const match = path.match(/\/gallery\/([^/]+)\/([^/]+)$/);
        if (!match) continue;
        const [, folder, filename] = match;
        const slug = slugify(folder);
        const group = grouped.get(slug) ?? { folder, files: [] };
        group.files.push({ filename, src });
        grouped.set(slug, group);
    }

    const albums: GalleryAlbum[] = [];

    for (const [slug, group] of grouped) {
        const files = group.files;
        files.sort((a, b) =>
            a.filename.localeCompare(b.filename, undefined, { numeric: true }),
        );

        const entry = entriesBySlug.get(slug);
        const title = entry?.data.title ?? prettifySlug(group.folder);
        const coverName = entry?.data.cover;

        const photos: GalleryPhoto[] = files.map((file, index) => {
            const caption =
                prettifyFilename(file.filename) || `Photo ${index + 1}`;
            return {
                src: file.src,
                filename: file.filename,
                caption,
                alt: `${title} — ${caption}`,
            };
        });

        const explicitCover = coverName
            ? photos.find((photo) => photo.filename === coverName)
            : undefined;

        albums.push({
            slug,
            title,
            description: entry?.data.description ?? "",
            date: entry?.data.date,
            cover: explicitCover ?? photos[0],
            photos,
        });
    }

    albums.sort((a, b) => {
        if (a.date && b.date) return b.date.valueOf() - a.date.valueOf();
        if (a.date) return -1;
        if (b.date) return 1;
        return a.title.localeCompare(b.title);
    });

    return albums;
}
