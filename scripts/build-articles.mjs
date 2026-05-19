#!/usr/bin/env node
// Generate static news/posts/<id>.html files from data/posts.json + markdown
// bodies, plus a fresh sitemap.xml that includes the static pages and articles.
//
// Run via `bun run build:articles` (also wrapped by `bun run build`).
// The pre-commit hook re-runs this when relevant sources are staged.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { marked } from "marked";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_ORIGIN = "https://www.lascifair.org";
const FALLBACK_OG = `${SITE_ORIGIN}/images/og-card.png`;
const FALLBACK_OG_ALT =
  "LA Science Fair — Los Angeles County Science & Engineering Fair, est. 1950";

// Static (non-article) pages that should appear in the sitemap. Update when a
// new top-level page is added.
const STATIC_PAGES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/about.html", changefreq: "monthly", priority: "0.7" },
  { path: "/schedule.html", changefreq: "weekly", priority: "0.9" },
  { path: "/news.html", changefreq: "weekly", priority: "0.8" },
  { path: "/students.html", changefreq: "monthly", priority: "0.9" },
  { path: "/students/how-to-participate.html", changefreq: "monthly", priority: "0.7" },
  {
    path: "/students/student-project-registration.html",
    changefreq: "monthly",
    priority: "0.7",
  },
  { path: "/students/pre-approval.html", changefreq: "monthly", priority: "0.8" },
  { path: "/students/pre-approval-faq.html", changefreq: "monthly", priority: "0.7" },
  { path: "/students/rules-regulations.html", changefreq: "monthly", priority: "0.8" },
  {
    path: "/students/supervisor-qualifications.html",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/students/understanding-src-results.html",
    changefreq: "monthly",
    priority: "0.6",
  },
  { path: "/site-coordinators.html", changefreq: "monthly", priority: "0.8" },
  { path: "/judges.html", changefreq: "monthly", priority: "0.8" },
  { path: "/volunteer.html", changefreq: "monthly", priority: "0.8" },
  { path: "/forms.html", changefreq: "monthly", priority: "0.8" },
  { path: "/contact.html", changefreq: "monthly", priority: "0.7" },
  { path: "/advisory-committee.html", changefreq: "yearly", priority: "0.5" },
  { path: "/sponsors.html", changefreq: "monthly", priority: "0.7" },
  { path: "/gallery.html", changefreq: "monthly", priority: "0.7" },
  { path: "/category-descriptions.html", changefreq: "yearly", priority: "0.5" },
];

// Mirrors CATEGORY_STYLES in js/news-feed.js so the rendered article looks the
// same whether served statically or rendered by JS at runtime.
const CATEGORY_STYLES = {
  Announcement: { bg: "bg-surface", text: "text-primary" },
  "For Judges": { bg: "bg-secondary-container", text: "text-on-secondary-fixed-variant" },
  "Success Stories": { bg: "bg-tertiary-fixed", text: "text-on-tertiary-fixed-variant" },
  "For Teachers": { bg: "bg-surface-variant", text: "text-on-surface-variant" },
  "For Students": { bg: "bg-primary-fixed", text: "text-on-primary-fixed" },
};
const DEFAULT_STYLE = {
  bg: "bg-secondary-container",
  text: "text-on-secondary-fixed-variant",
};
const categoryStyle = (c) => CATEGORY_STYLES[c] || DEFAULT_STYLE;

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]
  );

const formatDateLong = (iso) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function articlePage(article, bodyHtml) {
  const style = categoryStyle(article.category);
  const ogImage = article.image || FALLBACK_OG;
  const ogImageAlt = article.image ? article.title : FALLBACK_OG_ALT;
  const url = `${SITE_ORIGIN}/news/posts/${article.id}.html`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/x-icon" href="../../images/favicon.ico" />
    <link rel="icon" type="image/png" sizes="32x32" href="../../images/favicon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="../../images/apple-touch-icon.png" />
    <meta content="width=device-width, initial-scale=1.0" name="viewport" />
    <title>${escapeHtml(article.title)} - LA Science Fair</title>
    <meta name="description" content="${escapeHtml(article.excerpt)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="LA Science Fair" />
    <meta property="og:title" content="${escapeHtml(article.title)}" />
    <meta property="og:description" content="${escapeHtml(article.excerpt)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}" />
    <meta property="article:published_time" content="${article.date}T00:00:00Z" />
    <meta property="article:section" content="${escapeHtml(article.category)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(article.title)}" />
    <meta name="twitter:description" content="${escapeHtml(article.excerpt)}" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
    <link href="https://fonts.googleapis.com" rel="preconnect" />
    <link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect" />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&amp;family=Public+Sans:wght@600;700&amp;display=swap"
      rel="stylesheet" />
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap"
      rel="stylesheet" />
    <link rel="stylesheet" href="../../css/styles.css" />
    <script src="../../js/components.js"></script>
  </head>
  <body class="bg-background text-on-background min-h-screen flex flex-col font-body-md">
    <div id="site-header"></div>
    <main
      class="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-stack-xl">
      <article class="max-w-3xl mx-auto">
        <a
          href="../../news.html"
          class="inline-flex items-center text-secondary hover:text-primary mb-stack-md font-label-md text-label-md">
          <span class="material-symbols-outlined text-[18px] mr-1">arrow_back</span>
          Back to News
        </a>
        <div class="mb-stack-md">
          <span
            class="inline-block ${style.bg} ${style.text} px-3 py-1 rounded text-label-md font-label-md uppercase tracking-wide"
            >${escapeHtml(article.category)}</span
          >
        </div>
        <h1 class="font-headline-xl text-headline-xl text-primary mb-stack-md">
          ${escapeHtml(article.title)}
        </h1>
        <div
          class="flex items-center text-secondary font-label-md text-label-md mb-stack-lg">
          <span class="material-symbols-outlined text-[16px] mr-1">calendar_today</span>
          <span>${formatDateLong(article.date)}</span>
        </div>
        ${
          article.image
            ? `<img
          class="w-full rounded-lg mb-stack-lg"
          src="${escapeHtml(article.image)}"
          alt="${escapeHtml(article.title)}"
          loading="lazy" />`
            : ""
        }
        <div class="prose prose-lg max-w-none">${bodyHtml}</div>
      </article>
    </main>
    <div id="site-footer"></div>
  </body>
</html>
`;
}

function buildSitemap(articles) {
  const urlEntries = [
    ...STATIC_PAGES.map((p) => ({
      loc: `${SITE_ORIGIN}${p.path}`,
      changefreq: p.changefreq,
      priority: p.priority,
    })),
    ...articles.map((a) => ({
      loc: `${SITE_ORIGIN}/news/posts/${a.id}.html`,
      lastmod: a.date,
      changefreq: "yearly",
      priority: "0.6",
    })),
  ];

  const xml = ['<?xml version="1.0" encoding="UTF-8"?>'];
  xml.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  for (const e of urlEntries) {
    xml.push("  <url>");
    xml.push(`    <loc>${e.loc}</loc>`);
    if (e.lastmod) xml.push(`    <lastmod>${e.lastmod}</lastmod>`);
    xml.push(`    <changefreq>${e.changefreq}</changefreq>`);
    xml.push(`    <priority>${e.priority}</priority>`);
    xml.push("  </url>");
  }
  xml.push("</urlset>");
  xml.push("");
  return xml.join("\n");
}

// --- Main ---------------------------------------------------------------

const articles = JSON.parse(readFileSync(join(ROOT, "data/posts.json"), "utf8"));

mkdirSync(join(ROOT, "news/posts"), { recursive: true });

let totalBytes = 0;
for (const article of articles) {
  // Resolve relative image paths against the article's own directory so
  // contributors can write ![Alt](image.jpg) for a co-located file and have
  // it resolve correctly in the output at news/posts/<id>.html.
  const articleDir = `news/posts/${dirname(article.file)}`;
  const renderer = new marked.Renderer();
  renderer.image = ({ href, title, text }) => {
    if (href && !/^(https?:)?\//.test(href)) {
      href = `/${articleDir}/${href}`;
    }
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr}>`;
  };

  const md = readFileSync(join(ROOT, "news/posts", article.file), "utf8");
  const bodyHtml = marked.parse(md, { renderer });
  const html = articlePage(article, bodyHtml);
  const outPath = join(ROOT, "news/posts", `${article.id}.html`);
  writeFileSync(outPath, html);
  totalBytes += html.length;
  console.log(`✓ news/posts/${article.id}.html (${(html.length / 1024).toFixed(1)} KB)`);
}

writeFileSync(join(ROOT, "sitemap.xml"), buildSitemap(articles));
console.log(`✓ sitemap.xml (${STATIC_PAGES.length} static + ${articles.length} article URLs)`);
console.log(`Total: ${articles.length} articles, ${(totalBytes / 1024).toFixed(1)} KB`);
