# ADR 0005 — Light default, one typeface, and two section treatments

- **Status:** accepted
- **Date:** 2026-08-16
- **Work-order:** `work-orders/005-site-refresh.md`
- **Supersedes:** the dark-house-style decision recorded in `qshield-update-spec.md §5` and
  restated in `website-ia-spec.md §1` (both vault documents)

## Context

The homepage was Q-Shield-forward, used a three-face type system, and defaulted to a dark theme
chosen early and never revisited. Meanwhile the company acquired five more named surfaces and a
positioning line that its own canon flags as too narrow.

The founder's reference points are explicit: SemiAnalysis's own properties. Those were checked
directly rather than from memory:

- **InferenceX** (`inferencex.semianalysis.com`) — light, ground `#eaebec`, ink `#131416`,
  **DM Sans for both text and numerals**, section panels at 14px radius with a 1px hairline border,
  a translucent near-white fill and 32px padding, no shadow.
- **ClusterMAX** (`clustermax.ai`) — **dark**, same panel discipline, its own product-specific nav.

The single most useful observation: those two products do *not* share a skin. SemiAnalysis gives
each property its own visual identity rather than one house theme.

## Decisions

### 1. Light is the default theme; dark is a designed alternate

This reverses a standing decision. The prior reasoning ("dark house style is brand equity") was
recorded before the company had a homepage distinct from its dashboard, and the equity in question
was really Q-Shield's, not Q-Advantage's.

Dark is not an inversion — it is a separately chosen palette. `navy` is retired; three themes was
one too many and the third never earned its maintenance cost.

**Consequence:** a returning visitor with `qadv-theme=dark` in localStorage stays dark. A visitor
holding the retired `navy` value falls through to light rather than to a theme with no tokens
behind it.

### 2. One typeface — DM Sans — for text *and* numerals

Previously Inter Tight (body) + Instrument Serif (display, italic) + Geist Mono (numbers).

For a company whose product is measurement, the digits are the content. Setting them in a
different family from the prose makes them read as a different voice, and a monospace face buys
alignment we already get from `font-variant-numeric: tabular-nums`. InferenceX reaches the same
conclusion; we verified it rather than inferring it.

`font-serif` and `font-mono` are **aliased** to DM Sans rather than removed, because both classes
appear across roughly 21 files that predate this system. Aliasing repaints them all in one move
instead of churning every call site. A separate `font-code` family is retained for literal code in
blog posts — the one place a real monospace still earns its keep. Retire the aliases when those
files are next touched.

### 3. Gold is the brand accent; blue carries links; green/amber/red stay semantic

The previous palette used green for the brand *and* for "ok"/"live"/"faster", so a status signal
and a brand signal were the same colour. Splitting them means a warning can never read as brand.

`accent` is a **surface** token. Accent-coloured text uses `accent-ink`, which is the
contrast-safe partner on each ground — gold at `#e8a830` on a light ground fails WCAG as text,
which is exactly the trap the split avoids.

### 4. Two section treatments, deliberately different

- **Treatment A — floating panels.** Rounded 14px, hairline border, translucent fill, on a faintly
  contoured ground. The homepage and blog.
- **Treatment C — continuous framed grid.** Shared edges, tight radii, denser. Reserved for
  product surfaces.

This is the ClusterMAX/InferenceX split applied deliberately: the parent company reads as
editorial, the instruments read as tools. A visitor clicking into Q-Shield should feel they have
entered a different property, because they have.

### 5. Navigation moves to Home · Blog · Products▾ · Tools▾ · Contact

`website-ia-spec.md §3` deferred dropdowns until a fourth product went live. That trigger was a
proxy for "the flat nav stops working," and six named surfaces reached that point first. About,
Methodology, Corrections, Privacy and the benchmark source move to the footer.

## Consequences

**Good.** One coherent system across every route; the homepage finally argues the company's case
rather than Q-Shield's; the type system is smaller and cheaper; light/dark are both explicitly
designed rather than one being an afterthought.

**Costs, stated plainly.**

- Q-Shield, Q-Day Index and the static pages inherit the new palette and typeface immediately,
  before their own layouts have been polished for it. They are coherent, not finished. Treatment C
  lands in a follow-up.
- The italic display device (`<em>` inside serif headings) is gone. DM Sans has no true italic in
  this configuration, so any remaining `italic` class synthesises an oblique. Those call sites
  should lose the class as their files are touched.
- Two vault documents now contradict the shipped site. Correcting them is the founder's, in the
  vault — per `CLAUDE.md`, this repo never writes through `context/`.

## Alternatives considered

- **Keep dark as default, port the panel structure into it.** Rejected: the founder selected a
  light comp, and the light register is what the reference properties use for their editorial
  surface. Dark remains fully supported.
- **Keep a monospace face for data.** Rejected on the evidence above, and because a second family
  for numbers is exactly the thing InferenceX does not do.
- **One treatment everywhere.** Rejected: it would make the products look like sections of the
  marketing site rather than instruments in their own right.
