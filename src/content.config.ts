import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

export const collections = {
  blog: defineCollection({
    loader: glob({ pattern: "**/*.md", base: "src/content/blog" }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: z.string().optional(),
    }),
  }),
  projects: defineCollection({
    loader: glob({ pattern: "**/*.md", base: "src/content/projects" }),
    schema: z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      github: z.string().url(),
      screenshots: z.array(z.string()).optional(),
    }),
  }),
};
