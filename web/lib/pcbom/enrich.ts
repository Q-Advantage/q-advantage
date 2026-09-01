/**
 * P-CBOM Capability 2 — upload-and-enrich.
 *
 * Takes a CycloneDX 1.6+ CBOM produced by somebody else's scanning tooling and
 * returns it annotated with real Q-Shield performance data wherever a
 * cryptographic asset names an algorithm this repo has actually measured.
 *
 * Three rules govern everything here, and they are the reason this file is
 * longer than a bulk `Object.assign` would be:
 *
 * 1. **Never silently skip.** A component that was not enriched is reported by
 *    name with the reason. An unmatched algorithm looks identical to a bug
 *    unless the tool says which one it was and why it was left alone.
 * 2. **Never guess an identity.** Matching is exact against the normalized
 *    canonical name, using the same `normalizePcbomName` the emitter uses. A
 *    CBOM saying `Kyber768` is NOT silently treated as `ML-KEM-768`: that is an
 *    identity claim, and this repo's sourcing standard does not let a tool make
 *    one on a user's inventory. It is reported as unmatched, by name, so the
 *    reader can decide.
 * 3. **Never mutate the input.** The caller's parsed document is deep-cloned
 *    before a single property is attached, so a failed enrichment cannot leave
 *    a half-annotated document behind.
 *
 * Everything in this module is a pure function over JSON. Nothing here reads a
 * file, opens a socket, or touches the network — which is what makes the
 * privacy position on the page structurally true rather than a promise: an
 * uploaded CBOM is a company's real cryptographic inventory, and it never
 * leaves the browser because there is nothing here that could send it.
 */

import type { PcbomCatalog, PcbomCatalogEntry } from "./catalog";
import { normalizePcbomName, type PcbomCdxProperty } from "./emit";

/** The P-CBOM property namespace. Every key this tool writes starts with it. */
export const PCBOM_NS = "q-advantage:p-cbom";

/** Minimum CycloneDX spec version P-CBOM v0.1 binds to. */
export const MIN_SPEC_VERSION = 1.6;

// ---------------------------------------------------------------- types ---

export interface CdxComponent {
  type?: string;
  name?: string;
  "bom-ref"?: string;
  cryptoProperties?: {
    assetType?: string;
    algorithmProperties?: { parameterSetIdentifier?: string; [k: string]: unknown };
    [k: string]: unknown;
  };
  properties?: PcbomCdxProperty[];
  externalReferences?: { type: string; url: string; comment?: string }[];
  components?: CdxComponent[];
  [k: string]: unknown;
}

export interface CdxDocument {
  bomFormat?: string;
  specVersion?: string;
  components?: CdxComponent[];
  [k: string]: unknown;
}

export type SkipReason =
  | "no-algorithm-identifier"
  | "not-measured"
  | "asset-type-out-of-scope";

export interface EnrichedComponent {
  /** The component's own name, as it appeared in the caller's document. */
  componentName: string;
  /** The identifier the match was made on, after normalization. */
  matchedAlgorithm: string;
  /** Which measured operation's record was attached, and why that one. */
  operation: string;
  propertiesAdded: number;
}

export interface SkippedComponent {
  componentName: string;
  /** What the document called it — echoed verbatim, never corrected. */
  identifier: string | null;
  reason: SkipReason;
  /** Present when reason is asset-type-out-of-scope. */
  assetType?: string;
}

export interface EnrichSummary {
  componentsTotal: number;
  cryptoAssetsTotal: number;
  enriched: EnrichedComponent[];
  skipped: SkippedComponent[];
  /** Canonical names this catalog could have matched, for the page to show. */
  measuredAlgorithms: string[];
}

export interface EnrichResult {
  document: CdxDocument;
  summary: EnrichSummary;
  /** Overlay-schema failures on OUR OWN output. Empty is the only good value. */
  overlayProblems: string[];
}

// ----------------------------------------------------------- structure ---

export interface StructureProblem {
  field: string;
  message: string;
}

/**
 * Structural gate before enrichment.
 *
 * This is deliberately NOT a CycloneDX schema validator, and the page says so.
 * `p-cbom-0.1.cdx.json`'s own description draws that line: it validates the
 * P-CBOM overlay only, and "the host document must independently validate
 * against the stock CycloneDX 1.6+ schema". Reimplementing that schema here
 * would be exactly the from-scratch validator the build spec says not to
 * write. What these checks establish is narrower and sufficient: that the
 * document is a CycloneDX BOM, at a version P-CBOM v0.1 binds to, with a
 * component tree this tool can walk without guessing.
 */
export function checkCdxStructure(doc: unknown): StructureProblem[] {
  const problems: StructureProblem[] = [];

  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return [{ field: "(document)", message: "Not a JSON object." }];
  }
  const d = doc as CdxDocument;

  if (d.bomFormat !== "CycloneDX") {
    problems.push({
      field: "bomFormat",
      message: `Expected "CycloneDX", found ${d.bomFormat === undefined ? "nothing" : JSON.stringify(d.bomFormat)}.`,
    });
  }

  const raw = d.specVersion;
  if (raw === undefined) {
    problems.push({ field: "specVersion", message: "Missing. P-CBOM v0.1 binds to CycloneDX 1.6 or later." });
  } else {
    const parsed = Number.parseFloat(String(raw));
    if (!Number.isFinite(parsed)) {
      problems.push({ field: "specVersion", message: `Unreadable version ${JSON.stringify(raw)}.` });
    } else if (parsed < MIN_SPEC_VERSION) {
      problems.push({
        field: "specVersion",
        message: `Document is CycloneDX ${raw}. P-CBOM v0.1 binds to 1.6 or later, where cryptographic assets are defined.`,
      });
    }
  }

  if (d.components !== undefined && !Array.isArray(d.components)) {
    problems.push({ field: "components", message: "Present but not an array." });
  }

  return problems;
}

// -------------------------------------------------------------- walking ---

/**
 * Every component in the tree, depth-first.
 *
 * CycloneDX lets a component nest child components, and a crypto asset can sit
 * at any depth. Walking only the top level would silently under-report on any
 * real inventory that groups assets under an application or service.
 */
export function walkComponents(components: CdxComponent[] | undefined): CdxComponent[] {
  const out: CdxComponent[] = [];
  const visit = (list: CdxComponent[] | undefined, depth: number) => {
    if (!Array.isArray(list) || depth > 64) return;
    for (const c of list) {
      if (typeof c !== "object" || c === null) continue;
      out.push(c);
      visit(c.components, depth + 1);
    }
  };
  visit(components, 0);
  return out;
}

/**
 * The algorithm identifier a crypto-asset component declares.
 *
 * `cryptoProperties.algorithmProperties.parameterSetIdentifier` is the precise
 * field and wins; `name` is the fallback, because plenty of real scanners fill
 * only that. Returns null rather than an empty string so "declared nothing" is
 * distinguishable from "declared something unusable".
 */
export function cdxAlgorithmIdentifier(component: CdxComponent): string | null {
  const param = component.cryptoProperties?.algorithmProperties?.parameterSetIdentifier;
  if (typeof param === "string" && param.trim()) return param.trim();
  if (typeof component.name === "string" && component.name.trim()) return component.name.trim();
  return null;
}

/**
 * The representative operation for an algorithm family.
 *
 * A CycloneDX cryptographic asset is an *algorithm*; Q-Shield measures per
 * *operation*. Something has to choose, and choosing silently would be worse
 * than choosing badly, so the choice is named here, surfaced in the summary,
 * and written into the attached record's `measurement_id`.
 *
 * - KEMs attach `encaps`. It is the operation a server performs per handshake,
 *   and it is the one the catalog hangs the classical baseline off.
 * - Signatures attach `sign`. Verification is cheaper and more often quoted;
 *   signing is the cost that actually constrains a deployment.
 */
export function representativeOperation(entries: PcbomCatalogEntry[]): PcbomCatalogEntry | null {
  if (entries.length === 0) return null;
  const preferred = entries[0].native.algorithm.type === "key-encapsulation" ? "encaps" : "sign";
  return entries.find((e) => e.operation === preferred) ?? entries[0];
}

// ------------------------------------------------------------ enriching ---

function stripPcbomProperties(props: PcbomCdxProperty[] | undefined): PcbomCdxProperty[] {
  if (!Array.isArray(props)) return [];
  return props.filter((p) => !(typeof p?.name === "string" && p.name.startsWith(`${PCBOM_NS}:`)));
}

/**
 * Index the catalog by canonical algorithm name.
 *
 * Exact match on the normalized name only. See rule 2 in this file's header:
 * an alias table would be this tool asserting that two names denote the same
 * algorithm, on somebody else's inventory, without a primary source for the
 * claim. Unmatched names are reported instead.
 */
export function indexCatalog(catalog: PcbomCatalog): Map<string, PcbomCatalogEntry[]> {
  const byName = new Map<string, PcbomCatalogEntry[]>();
  for (const entry of catalog.entries) {
    const key = normalizePcbomName(entry.algorithmName).toUpperCase();
    const list = byName.get(key);
    if (list) list.push(entry);
    else byName.set(key, [entry]);
  }
  return byName;
}

export function enrichCdxDocument(doc: CdxDocument, catalog: PcbomCatalog): EnrichResult {
  // Rule 3: never mutate the caller's document.
  const document: CdxDocument = JSON.parse(JSON.stringify(doc));
  const byName = indexCatalog(catalog);

  const all = walkComponents(document.components);
  const enriched: EnrichedComponent[] = [];
  const skipped: SkippedComponent[] = [];
  let cryptoAssetsTotal = 0;

  for (const component of all) {
    if (component.type !== "cryptographic-asset") continue;
    cryptoAssetsTotal += 1;

    const componentName = typeof component.name === "string" ? component.name : "(unnamed component)";
    const identifier = cdxAlgorithmIdentifier(component);

    const assetType = component.cryptoProperties?.assetType;
    if (assetType !== "algorithm") {
      // v0.1 binds to algorithm assets; `protocol` is reserved for v0.2 by the
      // schema's own comment. Enriching one anyway would attach an
      // algorithm-shaped record to something that is not an algorithm.
      skipped.push({
        componentName,
        identifier,
        reason: "asset-type-out-of-scope",
        assetType: typeof assetType === "string" ? assetType : "(none declared)",
      });
      continue;
    }

    if (!identifier) {
      skipped.push({ componentName, identifier: null, reason: "no-algorithm-identifier" });
      continue;
    }

    const key = normalizePcbomName(identifier).toUpperCase();
    const entries = byName.get(key);
    const chosen = entries ? representativeOperation(entries) : null;
    if (!chosen) {
      skipped.push({ componentName, identifier, reason: "not-measured" });
      continue;
    }

    const additions = chosen.cdx.properties;
    component.properties = [...stripPcbomProperties(component.properties), ...additions];

    // Replace our own external reference rather than appending a duplicate on
    // a re-run; leave every other reference the document carried untouched.
    const ours = chosen.cdx.externalReferences[0];
    const others = (component.externalReferences ?? []).filter(
      (r) => !(typeof r?.comment === "string" && r.comment.startsWith("P-CBOM performance reference")),
    );
    component.externalReferences = ours ? [...others, ours] : others;

    enriched.push({
      componentName,
      matchedAlgorithm: chosen.algorithmName,
      operation: chosen.operation,
      propertiesAdded: additions.length,
    });
  }

  const overlayProblems: string[] = [];
  for (const component of walkComponents(document.components)) {
    if (component.type !== "cryptographic-asset") continue;
    const wasEnriched = (component.properties ?? []).some((p) => p?.name === `${PCBOM_NS}:extension`);
    if (!wasEnriched) continue;
    overlayProblems.push(...validatePcbomOverlay(component));
  }

  return {
    document,
    summary: {
      componentsTotal: all.length,
      cryptoAssetsTotal,
      enriched,
      skipped,
      measuredAlgorithms: [...new Set(catalog.entries.map((e) => e.algorithmName))].sort(),
    },
    overlayProblems,
  };
}

// ------------------------------------------------------------ overlay ----

/**
 * The constraints `schema/p-cbom-0.1.cdx.json` encodes, checked directly.
 *
 * That schema is small and closed — a `type` const, an `assetType` const, and
 * six required namespaced properties. Asserting those six by name is not
 * writing a JSON-schema validator; it is checking our own output against the
 * contract we publish, which is the one piece of validation P-CBOM genuinely
 * owns. If this ever returns a problem, the tool has produced a component that
 * does not satisfy the interoperability contract it claims to, and the page
 * must refuse to offer it for download.
 */
export const REQUIRED_OVERLAY_PROPERTIES = [
  "extension",
  "source",
  "measurement_id",
  "ref_url",
  "last_measured",
  "commit",
] as const;

/**
 * The structural minimum this check needs. Deliberately narrower than
 * `CdxComponent` so it also accepts a freshly emitted `PcbomCdxComponent`
 * straight from `toCdx()` — the emitter's own output has to be checkable
 * against the contract without being widened to an open-ended record first.
 */
export interface OverlayCandidate {
  type?: string;
  name?: string;
  cryptoProperties?: { assetType?: string };
  properties?: PcbomCdxProperty[];
}

export function validatePcbomOverlay(component: OverlayCandidate): string[] {
  const problems: string[] = [];
  const label = typeof component.name === "string" ? component.name : "(unnamed component)";

  if (component.type !== "cryptographic-asset") {
    problems.push(`${label}: type must be "cryptographic-asset", found ${JSON.stringify(component.type)}.`);
  }
  if (component.cryptoProperties?.assetType !== "algorithm") {
    problems.push(
      `${label}: cryptoProperties.assetType must be "algorithm" for P-CBOM v0.1, found ${JSON.stringify(
        component.cryptoProperties?.assetType,
      )}.`,
    );
  }

  const props = component.properties;
  if (!Array.isArray(props)) {
    problems.push(`${label}: properties[] is missing.`);
    return problems;
  }

  for (const suffix of REQUIRED_OVERLAY_PROPERTIES) {
    const name = `${PCBOM_NS}:${suffix}`;
    const found = props.find((p) => p?.name === name);
    if (!found) {
      problems.push(`${label}: required property ${name} is missing.`);
    } else if (typeof found.value !== "string" || !found.value) {
      problems.push(`${label}: property ${name} has no value.`);
    } else if (suffix === "extension" && found.value !== "0.1") {
      problems.push(`${label}: ${name} must be "0.1", found ${JSON.stringify(found.value)}.`);
    }
  }

  return problems;
}

// -------------------------------------------------------------- parsing ---

export type ParseOutcome =
  | { ok: true; document: CdxDocument }
  | { ok: false; error: string };

/** Parse pasted or uploaded text, with an error a person can act on. */
export function parseCdxText(text: string): ParseOutcome {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Nothing to read — paste a CycloneDX document or choose a file." };
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "Valid JSON, but not a JSON object — a CycloneDX BOM is an object at its root." };
    }
    return { ok: true, document: parsed as CdxDocument };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Not valid JSON: ${message}` };
  }
}

/** One-line coverage sentence, per the build spec's own wording. */
export function coverageSentence(summary: EnrichSummary): string {
  const { enriched, cryptoAssetsTotal } = summary;
  if (cryptoAssetsTotal === 0) {
    return "No cryptographic-asset components found in this document — nothing to enrich.";
  }
  const n = enriched.length;
  const noun = cryptoAssetsTotal === 1 ? "component" : "components";
  return `${n} of ${cryptoAssetsTotal} cryptographic-asset ${noun} enriched with live Q-Shield data.`;
}
