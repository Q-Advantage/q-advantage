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

## PR and final CI status

Draft PR: https://github.com/Q-Advantage/q-advantage/pull/68. Vercel built the preview successfully at https://q-advantage-git-codex-research-publishing-sprint-q-advantage.vercel.app/blog. Browser access redirects to Vercel login, so the deployed page was not visually verified; the local build was verified instead.

GitHub run 38079841595 passed the web type-check, lint, build and unit-test steps, but its two jobs are red because of existing benchmark checks outside the changed files:

- Harness: `benchmark/tests/test_workflow_shape.py:111` expects runner labels `[self-hosted, q-advantage-bench]`; current main's workflow uses `[self-hosted, c7i-x86]`. GitHub main file inspection confirmed the mismatch. 152 harness tests passed and this one failed.
- Web smoke: `web/scripts/smoke-trends.ts:35` rejects duplicate dates; current main data has 150 measurements over 149 distinct dates. The trend projection/smoke check and measured data are unchanged by this PR. Do not delete measurements or loosen a check to make this sprint pass. Resolve the benchmark issue separately before approving merge.

Production is unchanged. The PR remains draft, with these CI blockers explicitly reported.

## Visual revision — homepage continuity

The Research archive, all article pages and Editorial Standards now use one continuous white surface with the homepage's `cpv2-wrap`, Host Grotesk display typography and spacing. Removed the old editorial-page/panel wrappers, grey gutters, rounded section containers, boxed sources and related-publication cards. The feature reuses the existing homepage fibre photograph as decorative editorial imagery, with no new research claims. The archive no longer repeats the featured article in the list below it.

Research styles now live in `web/app/blog/research.css`, imported through `web/app/blog/layout.tsx`; the previous research style block was removed from the shared homepage stylesheet. Homepage and PQC Arena markup were not changed. Published article bodies, URLs, approval rules and content loading are unchanged.

Revised desktop (1440×1000) and mobile (390×844) archive/article layouts were visually checked. Both contain zero `.panel` containers, and mobile content stays within the viewport. Updated screenshots: private vault `coldproof-v3-handoff/research-flow-{index,article}-{desktop,mobile}.jpg`.

## Final publishing checks

Live HTTP inspection confirmed `coldproof.io/blog` redirects to `www.coldproof.io/blog`, served by Vercel. Canonical, sitemap, robots, RSS and structured-data URLs now use the final www host. The protected PR preview still requires a Vercel login; dashboard domain mapping was not inspected.

Hardened the existing subscription endpoint against null/non-string input and private provider-error disclosure. Mocked subscription tests cover normalization, missing configuration, malformed requests and provider failures without sending email or reading credentials. A proposed automatic Open Graph image route was removed after live testing reproduced Next 14's Windows `ERR_INVALID_URL`; optional custom images remain a later refinement. Canonical metadata and malformed-request HTTP responses were verified in the built app.

The file-based publishing trial uses test-only in-memory fixtures: drafts remain excluded from archive, lookup and RSS, while eligible structured content is discovered without a registry edit and renders tables, escaped text and downloads. No real draft was approved or published by this trial.

Final type checking, lint and production build passed (211 static pages); 16 test files and 285 tests passed. Local built preview is now http://localhost:3020/blog. Benchmark CI failures remain outside this sprint and were explicitly deferred by the user. Real newsletter delivery and a real article review need an authorized test email and chosen draft. Production remains unchanged pending founder approval and merge.
