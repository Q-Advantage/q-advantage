// web/lib/data/cfdir.ts
//
// Q-Shield's output, arranged by the framework a bank CFO already recognises.
//
// WHY. `qshield-update-spec.md` §16.1 states the structural mismatch that
// governs everything here: **CFDIR's framework is use-case-shaped, and
// Q-Shield's output is algorithm-shaped.** Their convention 3 is explicit —
// "migration will be applied on a use case basis, not a system-wide basis" —
// and their ledger is fourteen named use cases against eleven line items. A
// CFO-facing cost model cannot consume `algorithm → operation → timing`
// directly.
//
// The good news, and it means no re-architecture: the composed-protocol tracks
// (`tls_composed`, `ssh_composed`) are *already* the use-case layer. There are
// simply two of them against fourteen use cases. The gap is breadth, not shape.
//
// §16.6.2 asks for exactly this file's output: "a page that presents existing
// results arranged by CFDIR use case and line item, with the uncovered cells
// shown as visibly empty… the empty cells are the roadmap, published honestly."
//
// COVERAGE IS DERIVED, NOT DECLARED. The use-case taxonomy below is CFDIR's and
// is necessarily authored — it is their document. But whether we *cover* a use
// case is computed from what is actually loaded, so the map cannot drift from
// the record the way a hand-maintained table would. A track that stops
// producing data downgrades its own row.

import type { ProtocolsData } from "@/lib/protocols/types";

/**
 * The framework version this mapping targets.
 *
 * §16.6.3: pin it like a library version. CFDIR v.01 is dated 2026-06-29 and
 * the document says it "will be reviewed annually and may be revised" — so we
 * inherit their versioning, and a revision is a methodology event, not a silent
 * update.
 */
export const CFDIR_FRAMEWORK_VERSION = "v.01";
export const CFDIR_FRAMEWORK_DATED = "2026-06-29";

export type Coverage = "covered" | "partial" | "none" | "not-applicable";

export interface UseCase {
  /** CFDIR's own section number. */
  id: string;
  name: string;
  /** Which Q-Shield track, if any, prices this use case. */
  track: string | null;
  /** What is missing. Empty when fully covered. */
  gap: string;
  /** Coverage when the track's data is present. `not-applicable` ignores data. */
  coverageWhenPresent: Coverage;
}

/**
 * CFDIR §3.1–3.14. Their taxonomy, their numbering, their names.
 *
 * `track` is the join to our own data. `null` means nothing we measure prices
 * this use case, and no amount of data will change that row until a new track
 * exists — which is the honest thing for the page to say.
 */
export const USE_CASES: UseCase[] = [
  {
    id: "3.1",
    name: "Enterprise images — servers",
    track: null,
    gap: "No measurable cryptographic term. This line item is technology-acquisition cost, not a performance question.",
    coverageWhenPresent: "not-applicable",
  },
  {
    id: "3.2",
    name: "Certification Authorities",
    track: null,
    gap: "No CA issuance or chain-validation measurement exists.",
    coverageWhenPresent: "none",
  },
  {
    id: "3.3",
    name: "Enterprise PKI deployment",
    track: null,
    gap: "No issuance or rotation timing.",
    coverageWhenPresent: "none",
  },
  {
    id: "3.4",
    name: "TLS cipher suites",
    track: "tls-composed",
    gap: "",
    coverageWhenPresent: "covered",
  },
  {
    id: "3.5",
    name: "TLS certificates",
    track: "tls-composed",
    gap: "Timings yes, but certificate-chain bytes are explicitly out of scope — and the chain is the cost here.",
    coverageWhenPresent: "partial",
  },
  {
    id: "3.6",
    name: "Internally developed applications",
    track: null,
    gap: "Application-level, not primitive. Nothing we measure composes to it.",
    coverageWhenPresent: "none",
  },
  {
    id: "3.7",
    name: "Code-signing service",
    track: "sig-track",
    gap: "Sign timings and signature sizes exist; there is no service-level composition around them.",
    coverageWhenPresent: "partial",
  },
  {
    id: "3.8",
    name: "Code-signing verification",
    track: "sig-track",
    gap: "Verify timings exist; there is no verifier-fleet composition.",
    coverageWhenPresent: "partial",
  },
  {
    id: "3.9",
    name: "SSO / SAML",
    track: null,
    gap: "Two gaps stacked: RSA-PSS is not benchmarked at all, and nothing composes a sign/verify timing into a JWT-shaped budget.",
    coverageWhenPresent: "none",
  },
  {
    id: "3.10",
    name: "Secure email (S/MIME)",
    track: null,
    gap: "Not measured.",
    coverageWhenPresent: "none",
  },
  {
    id: "3.11",
    name: "Data-at-rest encryption",
    track: "aes-baseline",
    gap: "The symmetric baseline exists; asymmetric key-wrapping — the actual PQC-affected step — is not measured.",
    coverageWhenPresent: "partial",
  },
  {
    id: "3.12",
    name: "Network layer (IPsec / IKE / MACsec)",
    track: null,
    gap: "No IPsec composed track. Not a reskin of the TLS one — a missing track.",
    coverageWhenPresent: "none",
  },
  {
    id: "3.13",
    name: "SSH / SFTP (distributed)",
    track: "ssh-composed",
    gap: "",
    coverageWhenPresent: "covered",
  },
  {
    id: "3.14",
    name: "SSH / SFTP (centralised key management)",
    track: "ssh-composed",
    gap: "Same track, but no key-management dimension.",
    coverageWhenPresent: "partial",
  },
];

export interface LineItem {
  code: string;
  name: string;
  /** What CFDIR does with it. */
  cfdirUse: string;
  /** What Q-Shield must emit. Null for the procurement/labour items. */
  requirement: string | null;
  status: "met" | "partial" | "blocked" | "not-measurement";
  /** What is in the way, when something is. */
  blocker?: string;
}

/**
 * CFDIR's eleven line items. Five are measurement-dependent; the other six are
 * procurement and labour, sourced elsewhere and not our business.
 *
 * The `status` values here are the part worth keeping current: §16.3 called ER
 * and MIA "blocking dependencies for a revenue product", not optional breadth.
 */
export const LINE_ITEMS: LineItem[] = [
  {
    code: "T",
    name: "Testing",
    cfdirUse: "A whole performance-testing category resting on an assumption, with no number behind it.",
    requirement: "The classical-vs-PQC delta per use case.",
    status: "partial",
    blocker:
      "A delta needs a classical arm. TLS has one (X25519); the signature track has no RSA-PSS or ECDSA baseline, so for signing there is an absolute figure but no delta.",
  },
  {
    code: "MIA",
    name: "Monitoring & incidents",
    cfdirUse: "Hand-waved incident rates.",
    requirement: "Whether degradation actually occurs under load.",
    status: "partial",
    blocker:
      "Layer B now measures connections-per-core over live sockets. What is still missing is the same question for cryptographic throughput under CPU contention — a different number that must not share the same label.",
  },
  {
    code: "PO",
    name: "Parallel operation",
    cfdirUse: "Per-server cost across an unstated migration window.",
    requirement: "What serving both classical and PQC costs versus either alone.",
    status: "blocked",
    blocker:
      "Nothing measures running both stacks at once. The interesting term is not the arithmetic sum — it is whether the combination is superadditive through cache pressure and doubled session state.",
  },
  {
    code: "ER",
    name: "Expansion & retention",
    cfdirUse: "Storage for larger keys and signatures.",
    requirement: "Key and signature sizes, including private keys.",
    status: "partial",
    blocker:
      "Public key and signature sizes have always been published. Secret key size is now recorded too. Certificate-chain bytes and at-rest key-hierarchy sizing remain out of scope.",
  },
  {
    code: "UE",
    name: "Unexpected events",
    cfdirUse: "A contingency percentage.",
    requirement:
      "Not a contingency rate — we cannot emit one. The failure-mode evidence that would justify one.",
    status: "partial",
    blocker:
      "Layer B now produces downgrade and clean-rejection outcomes, and middlebox pass/fail for two proxies. Interoperability across independent implementations is still absent.",
  },
  { code: "TAE", name: "Technology acquisition — equipment", cfdirUse: "Procurement.", requirement: null, status: "not-measurement" },
  { code: "TAI", name: "Technology acquisition — implementation", cfdirUse: "Procurement.", requirement: null, status: "not-measurement" },
  { code: "CDAC", name: "Crypto discovery & asset classification", cfdirUse: "Labour and tooling.", requirement: null, status: "not-measurement" },
  { code: "DI", name: "Data inventory", cfdirUse: "Labour.", requirement: null, status: "not-measurement" },
  { code: "OM", name: "Ongoing maintenance", cfdirUse: "Labour.", requirement: null, status: "not-measurement" },
  { code: "D", name: "Decommissioning", cfdirUse: "Labour.", requirement: null, status: "not-measurement" },
];

export interface UseCaseCoverage extends UseCase {
  coverage: Coverage;
  /** True when the track exists in the taxonomy but produced no data. */
  trackMissing: boolean;
}

/**
 * Which tracks actually produced data in this build.
 *
 * Reads the loaded protocol data rather than a list, so a track that stops
 * running downgrades its own row instead of the page continuing to claim
 * coverage from a table nobody updated.
 */
export function tracksPresent(data: ProtocolsData): Set<string> {
  const present = new Set<string>();
  for (const arch of Object.keys(data.byArch ?? {})) {
    const bucket = data.byArch[arch];
    if (bucket?.tls?.suites && Object.keys(bucket.tls.suites).length) present.add("tls-composed");
    if (bucket?.ssh?.suites && Object.keys(bucket.ssh.suites).length) present.add("ssh-composed");
    if (bucket?.sig) present.add("sig-track");
    if (bucket?.aes) present.add("aes-baseline");
  }
  return present;
}

/**
 * Coverage per use case, computed from the data present in this build.
 *
 * Named `coverageByUseCase` rather than `useCaseCoverage` deliberately: in a
 * React codebase a `use`-prefixed function reads as a Hook, and the lint rules
 * enforce that reading. This is a plain projection over loaded data.
 */
export function coverageByUseCase(data: ProtocolsData): UseCaseCoverage[] {
  const present = tracksPresent(data);
  return USE_CASES.map((uc) => {
    if (uc.coverageWhenPresent === "not-applicable") {
      return { ...uc, coverage: "not-applicable", trackMissing: false };
    }
    if (!uc.track) return { ...uc, coverage: "none", trackMissing: false };
    const has = present.has(uc.track);
    return {
      ...uc,
      coverage: has ? uc.coverageWhenPresent : "none",
      // The distinction the page needs: a use case we never planned to cover
      // reads differently from one whose track has gone quiet.
      trackMissing: !has,
    };
  });
}

export interface CoverageTally {
  covered: number;
  partial: number;
  none: number;
  notApplicable: number;
  /** Total excluding the not-applicable rows — the honest denominator. */
  scorable: number;
}

export function tally(rows: UseCaseCoverage[]): CoverageTally {
  const t: CoverageTally = { covered: 0, partial: 0, none: 0, notApplicable: 0, scorable: 0 };
  for (const r of rows) {
    if (r.coverage === "covered") t.covered++;
    else if (r.coverage === "partial") t.partial++;
    else if (r.coverage === "not-applicable") t.notApplicable++;
    else t.none++;
  }
  t.scorable = rows.length - t.notApplicable;
  return t;
}

/**
 * The sentence the page leads with.
 *
 * Written here rather than in the component so the number and the words can
 * never disagree — the count is computed, not typed.
 */
export function coverageSentence(t: CoverageTally): string {
  return (
    `${t.covered} of ${t.scorable} use cases fully covered, ${t.partial} partial, ${t.none} not covered. ` +
    `That is the honest answer to whether Q-Shield can fill this ledger today.`
  );
}
