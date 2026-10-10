# Coldproof Research sprint audit — 10 October 2026

## Architecture and publication path

- Next.js 14.2.35 App Router, TypeScript, React 18, Tailwind; Coldproof CSS and Host Grotesk typography. No external CMS or Markdown/MDX dependency was configured.
- Before this sprint, three articles lived in `web/content/blog/*.tsx` and were explicitly registered in `web/lib/blog/posts.ts`. Publishing required React code and registry edits. The current GitHub `main` registry was inspected and contains the same three articles; all three are included in the design fix.
- Existing route `/blog` remains the coherent Research section. Individual `/blog/<slug>` URLs and article prose/dates are preserved. Categories now use All / Research Reports / Analysis / Data & Methods filters. No research reports are invented; that category has an honest empty state.
- New structured JSON publications live in `web/content/research`, are automatically discovered and validated, and use the same article template. They support author, update date, version, tags, evidence types, executive summary, anchored sections/contents, equations, responsive tables, approved figures, references and downloads.
- Authoring → private draft/evidence → local draft preview → human review → approved JSON/assets on a branch → GitHub PR checks → Vercel preview → founder merge → production. `web/vercel.json`, `.github/workflows/ci.yml`, `web/README.md` and `docs/runbook.md` describe Root Directory `web` and the Vercel Git integration. GitHub API inspection confirmed a public repo, default branch `main`, and a successful production deployment recorded on 10 October 2026 to a Vercel URL. The Vercel dashboard, production domain mapping and Beehiiv delivery were not verified or changed.

## Reference comparison

| Existing Coldproof | Scale reference | Implemented adaptation |
| --- | --- | --- |
| Chronological text list | Featured publishing and category navigation | Prominent featured publication, three editorial categories, responsive cards |
| Basic article masthead and source note | Clear author/date metadata, key points, illustrations and technical sections | Shared metadata, optional executive summary, structured figures/tables, references and related publications |
| No editorial policy linked in archive | Technical article evidence links and reader CTA | Compact financial evidence standard, dedicated standards page, research updates CTA |
| React-only publishing | Polished reusable editorial presentation | Validated file-based content and private draft preview; no CMS dependency |

Reference pages inspected: https://scale.com/blog, https://scale.com/blog/why-you-need-to-red-team-your-enterprise-ai, https://scale.com/blog/deploying-enterprise-ai-agents-with-scale-and-google-cloud. Text/layout structure was inspected through web extraction; Scale mobile behavior was not independently tested. No Scale assets, text or code were copied.

## Priorities and completed fixes

P0: A reliable publication gate and content validation. New content fails validation if published without a recorded human approval, has invalid dates/categories/evidence, unsafe reference links, duplicate anchors/slugs, malformed tables or incomplete figure labels. Drafts and future publications are withheld. Asset existence checks run before dev/build. Private draft preview requires no publication approval metadata. The operational gate remains human PR review and founder merge; a string field cannot authenticate a human decision.

P1: Archive and all three existing articles now share the Research presentation; references and original claims remain intact. Added editorial standards, source-aware template, responsive cards/category navigation, contact fallback for unconfigured subscriptions, canonical/OG metadata and Article structured data. Fixed old domain in root metadata, robots and sitemap. Added individual publications/standards to sitemap and RSS at `/blog/feed.xml`. Explicit content tracing protects file discovery in Vercel server functions. PQC Arena routes, integrations, benchmark code and measurement files were not edited.

## Verification

- Content validation: one draft template validated, three published legacy articles; template withheld.
- Type checking and lint: passed.
- Unit tests: 14 files, 279 tests passed, including 5 new editorial-gate tests.
- Production build: passed; 211 static pages generated. Initial sandbox EPERM errors were resolved by rerunning with filesystem access. The known historical Windows OG error did not recur.
- Private JSON draft preview: generated successfully without approval or public routing.
- Browser: Research landing page and `how-we-measure` at 1440×1000 and 390×844; no horizontal overflow at mobile width. Category Research Reports empty state checked. Article canonical and JSON-LD verified in DOM. Subscription placeholder was visible locally because integration variables were absent.
- Screenshots saved in the private vault `coldproof-v3-handoff/research-{index,article}-{desktop,mobile}.jpg`.
- Local built preview: http://localhost:3010/blog (requires the local server to remain running). No production deploy was performed.

## Changed files

- `web/app/blog/page.tsx`, `web/app/blog/[slug]/page.tsx`, `web/app/blog/editorial-standards/page.tsx`, `web/app/blog/feed.xml/route.ts`: research archive, shared article, standards and RSS.
- `web/components/blog/ResearchSubscribe.tsx`, `web/app/coldproof-v2.css`: subscription fallback and responsive editorial styling.
- `web/content/blog/{how-we-measure,benchmark-didnt-lie,cbom-vs-p-cbom}.tsx`: editorial categories only.
- `web/lib/blog/{posts.ts,publication.ts,publication.test.ts,files.tsx}`: legacy/archive integration, validated content model, publication gate and structured renderer.
- `web/content/research/_template.json`, `web/public/research/README.md`: unpublished template and approved-asset location.
- `web/scripts/{validate-research.ts,preview-research.tsx}`, `web/package.json`, `web/next.config.mjs`: validation/preview commands and server content tracing.
- `web/app/{layout.tsx,robots.ts,sitemap.ts}`: domain and discovery fixes.
- `docs/research-publishing.md`, this audit: publishing instructions, findings, checks and limitations.

## Outstanding and manual steps

- Review the PR preview, confirm `coldproof.io` is mapped to the intended Vercel project and approve the production merge. No secrets or deployment settings were inspected or changed.
- Verify Beehiiv subscription delivery through an authorized test address; environment presence alone does not establish a healthy provider.
- New articles use structured JSON rather than Markdown/MDX. This trades prose-editing convenience for zero added dependencies; a later Markdown adapter can use the same metadata gate if needed.
- Optional custom social images and finer article-level evidence annotations remain refinements. Existing archive claims/source notes and historic Q-Shield/Q-Advantage names are not retrospectively re-audited or rewritten.
- Scheduled content needs a build on/after its publication date; there is no automated scheduler.
- Unrelated files present on entry remain untouched: `numbers-of-the-week.md`, `web/qa-screenshots/`, `work-orders/028-paired-baseline-delta.md`.
