// Ensures every blog post has a GitHub Discussion in the "General" category
// so giscus comments load instantly without relying on giscus auto-create.
// Runs in CI on pushes touching blog content. Idempotent.
import { readdir } from "node:fs/promises";

const [owner, repoName] = process.env.GITHUB_REPOSITORY.split("/");
const SITE = "https://bys-exe.github.io";
const CATEGORY = "General";
const TOKEN = process.env.GH_TOKEN;

if (!TOKEN) throw new Error("GH_TOKEN is missing");

const gql = async (query, variables) => {
    const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    return json.data;
};

// Mirror Astro's content id for these filenames: lowercase, spaces -> hyphens.
const slugify = (name) =>
    name
        .replace(/\.md$/, "")
        .toLowerCase()
        .replace(/[\s_]+/g, "-");

const files = (await readdir("src/content/blog")).filter((f) =>
    f.endsWith(".md"),
);
const slugs = files.map(slugify);
console.log("slugs:", slugs.join(", "));

const { repository } = await gql(
    `query ($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
            id
            discussionCategories(first: 30) {
                nodes { id name }
            }
        }
    }`,
    { owner, name: repoName },
);
const category = repository.discussionCategories.nodes.find(
    (c) => c.name === CATEGORY,
);
if (!category) throw new Error(`Category ${CATEGORY} not found`);
console.log(`category ${CATEGORY}: ${category.id}`);

for (const slug of slugs) {
    const q = `repo:${owner}/${repoName} category:"${CATEGORY}" in:title "${slug}"`;
    const found = await gql(
        `query ($q: String!) {
            search(query: $q, type: DISCUSSION, first: 1) {
                discussionCount
            }
        }`,
        { q },
    );
    if (found.search.discussionCount > 0) {
        console.log(`exists: ${slug}`);
        continue;
    }
    const created = await gql(
        `mutation ($input: CreateDiscussionInput!) {
            createDiscussion(input: $input) {
                discussion { number url }
            }
        }`,
        {
            input: {
                repositoryId: repository.id,
                categoryId: category.id,
                title: slug,
                body: `# ${slug}\n\nComments for ${SITE}/blog/${slug}`,
            },
        },
    );
    console.log(`created: ${slug} -> ${created.createDiscussion.discussion.url}`);
}

// Verify exactly what giscus will query.
for (const slug of slugs) {
    const url =
        `https://giscus.app/api/discussions?repo=${owner}%2F${repoName}` +
        `&term=${encodeURIComponent(slug)}&category=${encodeURIComponent(CATEGORY)}&strict=0&first=1`;
    const res = await fetch(url);
    console.log(`giscus ${slug}: ${res.status}`);
    if (res.status !== 200) throw new Error(`giscus cannot see ${slug}`);
}
console.log("done");
