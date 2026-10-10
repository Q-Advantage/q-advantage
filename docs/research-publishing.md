# Coldproof research publishing

## Where content lives

Existing published articles remain in `web/content/blog/*.tsx`, registered in `web/lib/blog/posts.ts`. Their URLs and prose are preserved. All articles use `web/app/blog/[slug]/page.tsx`. The Research landing page remains `/blog` so existing links keep working; categories use query filters rather than extra routes.

New articles use `web/content/research/*.json`. The loader discovers files automatically: no React component or registry change is required. This structured file format avoids adding a CMS or Markdown dependency during the sprint. Text is rendered as plain text, without raw HTML or executable content. Legacy React publications can continue using the existing Prose components.

## Publish the next article

1. Create a branch. Copy `_template.json` to a descriptive filename, choose a unique slug (do not use `editorial-standards`), and leave `status` as `draft`.
2. Write title, summary, author, date, category (`Research Reports`, `Analysis`, `Data & Methods`), source note and evidence classifications. Add sections with stable IDs. Each section accepts paragraphs, bullets, a plain-text equation, a table or an approved figure. Add methodology, financial assumptions and limitations. Put original sources in `sources` and supporting material in `downloads`.
3. Store reviewed graphics and supporting files in `web/public/research/<slug>/`. Reference them as `/research/<slug>/chart.png` or `/research/<slug>/supporting-material.pdf`. Figures require descriptive alt text and a source-bearing caption. Table rows must match the header count. Charts should be approved static assets; no chart generator invents figures here.
4. Run `cd web`, `npm run validate:research`, `npm run type-check`, `npm run lint`, `npm test`, `npm run build`.
5. A human reviews the evidence, financial claims, assumptions and assets. Only following that decision, set `status` to `published`, record the actual human's name in `approvedBy` and the approval date in `approvedAt` (YYYY-MM-DD). Set the publication date appropriately. Never invent approval metadata. The machine gate verifies the record, not the identity of its author; human PR review and the founder's merge are mandatory.
6. Run `npm run dev` to preview the approved candidate locally. Drafts are deliberately excluded from public routes, index, RSS and sitemap. To preview a draft before approval, run `npm run preview:research -- content/research/<filename>.json` and open the printed local HTML file. It renders the draft privately in your system temporary directory without changing approval status. This is a content preview; use the local site or PR preview to review the final site styling after approval.
7. Push the reviewed branch and open a PR in `Q-Advantage/q-advantage`. Repository CI checks the app. Existing documentation says Vercel creates PR previews with Root Directory `web`; verify the actual preview and domain in Vercel before merging. No live dashboard configuration was verified during this sprint.
8. The founder approves and merges. Existing documented integration builds `web` and deploys production after merge. Do not use a production deploy command. Verify `https://coldproof.io/blog/<slug>` and the generated metadata after deployment.
9. Use that URL for separately reviewed LinkedIn/newsletter distribution. This sprint does not automatically distribute or email anything.

A future publication date is withheld until a build on/after that UTC date. There is no automatic scheduled deployment; trigger the normal approved deployment when due. Keep drafts in the private vault until ready for public repository review: hiding a route does not make a committed draft private.

## Revisions and rollback

For substantive revisions set `updated` and increment `version`; retain the original publication date and slug. Correct evidence in the article and sources, not in benchmark result files. Existing articles have not been retrospectively re-audited or assigned invented approval/version metadata. Roll back a change through a reviewed revert PR, or use the previous immutable Vercel deployment as described in `docs/runbook.md`.

## Subscriptions and discovery

The existing server endpoint uses Beehiiv with `BEEHIIV_API_KEY` and `BEEHIIV_PUB_ID`. No credentials were read or modified. Research pages show the form only if these variables are present; otherwise they show an honest contact link. Presence alone does not verify provider delivery; test with an authorized address after deployment. Research discovery uses canonical URLs, Article JSON-LD, publication-specific Open Graph text, `/blog/feed.xml`, and sitemap entries. A custom per-article social image remains optional; do not invent or silently reuse unapproved graphics.
