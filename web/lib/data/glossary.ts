// web/lib/data/glossary.ts
//
// The terms this site uses, defined once, each carrying its source.
//
// `qshield-update-spec.md` §5 lists a glossary as content work rather than
// engineering. It is — but this repo has a sourcing standard that makes it
// slightly more than a list of definitions:
//
//   "Any technical-factual claim (an OID, a security level, an algorithm
//    identity, a reference figure) must be cited to a primary source, or
//    flagged #unverified. An uncited identity block is the same failure mode
//    as a fabricated benchmark."
//
// A glossary is nothing but technical-factual claims, so every entry here
// either names the document it comes from or is explicitly marked unverified.
// `glossary.test.ts` enforces that — an entry with neither cannot ship.
//
// The distinction that shapes the entries: several of these terms are ones
// where a plausible-sounding wrong definition is the common case. Those get the
// correction stated, not just the definition.

export interface GlossaryTerm {
  term: string;
  /** Alternate spellings and abbreviations a reader might arrive with. */
  aka?: string[];
  definition: string;
  /**
   * The primary source. Null means the claim is `#unverified` and the entry
   * says so on the page — never silently.
   */
  source: { label: string; url?: string } | null;
  /**
   * A misreading this term commonly attracts, stated plainly. Present only
   * where there is a real one; padding this field would dilute the ones that
   * matter.
   */
  commonlyConfusedWith?: string;
  category: "algorithm" | "protocol" | "measurement" | "policy" | "network";
}

export const GLOSSARY: GlossaryTerm[] = [
  // --- algorithms ----------------------------------------------------------
  {
    term: "ML-KEM",
    aka: ["Kyber", "CRYSTALS-Kyber"],
    definition:
      "Module-Lattice-Based Key-Encapsulation Mechanism. The NIST-standardised algorithm for establishing a shared secret — the post-quantum replacement for a Diffie-Hellman key exchange. Parameter sets ML-KEM-512, -768 and -1024 target increasing security levels.",
    source: { label: "FIPS 203, Module-Lattice-Based Key-Encapsulation Mechanism Standard" },
    commonlyConfusedWith:
      "Its pre-standardisation name, Kyber. They are closely related but not interchangeable: FIPS 203 differs from the Kyber submission, so an implementation of one is not automatically an implementation of the other.",
    category: "algorithm",
  },
  {
    term: "ML-DSA",
    aka: ["Dilithium", "CRYSTALS-Dilithium"],
    definition:
      "Module-Lattice-Based Digital Signature Algorithm. The NIST-standardised general-purpose post-quantum signature scheme. Stateless: signing the same message twice is safe.",
    source: { label: "FIPS 204, Module-Lattice-Based Digital Signature Standard" },
    category: "algorithm",
  },
  {
    term: "SLH-DSA",
    aka: ["SPHINCS+"],
    definition:
      "Stateless Hash-Based Digital Signature Algorithm. A signature scheme whose security rests only on the hash function, with no lattice assumption. Also stateless, so it carries none of the key-reuse hazard of LMS or XMSS — the trade is size and speed.",
    source: { label: "FIPS 205, Stateless Hash-Based Digital Signature Standard" },
    commonlyConfusedWith:
      "LMS and XMSS, which are also hash-based but are stateful. The word that matters is 'stateless': it is what makes SLH-DSA safe to use as a drop-in where a signer might sign twice.",
    category: "algorithm",
  },
  {
    term: "LMS",
    aka: ["Leighton-Micali Signatures"],
    definition:
      "A stateful hash-based signature scheme. Each private key can produce a bounded number of signatures and each leaf index may be used exactly once; reusing one breaks the security guarantee completely.",
    source: { label: "RFC 8554, Leighton-Micali Hash-Based Signatures" },
    commonlyConfusedWith:
      "A drop-in for ML-DSA. It is not. Statefulness means the signer must reliably persist which indices it has used, which rules out naive deployment and is why the practical use case is firmware and code signing rather than TLS.",
    category: "algorithm",
  },
  {
    term: "XMSS",
    aka: ["eXtended Merkle Signature Scheme"],
    definition:
      "The other stateful hash-based signature scheme, with the same one-index-one-signature constraint as LMS. XMSSMT is its multi-tree variant, which trades key-generation time for a larger signature capacity.",
    source: { label: "RFC 8391, XMSS: eXtended Merkle Signature Scheme" },
    category: "algorithm",
  },
  {
    term: "X25519",
    definition:
      "The elliptic-curve Diffie-Hellman function over Curve25519. On this site it is the classical baseline every post-quantum key-exchange figure is measured against.",
    source: { label: "RFC 7748, Elliptic Curves for Security" },
    category: "algorithm",
  },
  {
    term: "AES-GCM",
    definition:
      "A symmetric authenticated-encryption mode. It appears on this site as the reference line underneath the asymmetric numbers — what a fast, boring, already-deployed operation costs, so the post-quantum figures have something to be read against.",
    source: { label: "NIST SP 800-38D, Galois/Counter Mode" },
    commonlyConfusedWith:
      "Something that needs replacing. Symmetric cryptography is not broken by a quantum computer in the way public-key cryptography is; the migration is a public-key problem.",
    category: "algorithm",
  },

  // --- protocol ------------------------------------------------------------
  {
    term: "Hybrid key exchange",
    definition:
      "A TLS key exchange that performs a classical exchange and a post-quantum one, combining both shared secrets. It is secure if either component holds, which is why it is the deployment most stacks have chosen first.",
    source: { label: "RFC 8446 §4.2.8 (key_share), as extended by hybrid group registrations" },
    commonlyConfusedWith:
      "A cheap way to get post-quantum security. It costs more than either half alone: the handshake carries both key shares, and this site measures that cost rather than assuming it.",
    category: "protocol",
  },
  {
    term: "X25519MLKEM768",
    definition:
      "The hybrid group combining X25519 with ML-KEM-768. The one most widely deployed at the time of writing.",
    source: null,
    commonlyConfusedWith:
      "Its code point is named in this site's Layer B output but is not yet confirmed against the IANA registry, so it is flagged #unverified there and here. Agreement between our table and one implementation is not a primary source.",
    category: "protocol",
  },
  {
    term: "Named group",
    definition:
      "The identifier TLS uses for a key-exchange method. The server selects one and echoes it in its ServerHello key_share extension — which is the only place a third party can read what was actually negotiated, rather than what either side reports.",
    source: { label: "RFC 8446 §4.2.7, supported_groups" },
    category: "protocol",
  },
  {
    term: "HelloRetryRequest",
    definition:
      "A ServerHello variant telling the client its key share was not acceptable and to retry with a different group. The handshake still succeeds, but it costs an extra round trip — which is invisible to anything that only looks at the final result.",
    source: { label: "RFC 8446 §4.1.4" },
    category: "protocol",
  },
  {
    term: "Downgrade",
    definition:
      "A negotiation that settles on a weaker option than the client offered — here, a classical group where a post-quantum one was available. It is not an error and produces no failure; that is exactly what makes it worth measuring deliberately rather than inferring from an absence of signal.",
    source: null,
    category: "protocol",
  },

  // --- measurement ---------------------------------------------------------
  {
    term: "Composed handshake",
    definition:
      "Q-Shield's Layer A method: each cryptographic phase is timed in its own loop and the handshake figure is their weighted sum, with classical keygen and derive counted twice because both parties perform them. It produces clean, comparable primitive numbers.",
    source: { label: "METHODOLOGY.md, and /methodology on this site" },
    commonlyConfusedWith:
      "A handshake timed end to end. It is not one — there is no socket and no network, which is precisely why packets, fragmentation and congestion behaviour are unmeasurable at Layer A and need Layer B.",
    category: "measurement",
  },
  {
    term: "Confidence interval",
    definition:
      "The range within which the true mean is estimated to lie, at a stated confidence level. Built from the standard error, which shrinks with the square root of the sample count.",
    source: null,
    commonlyConfusedWith:
      "Standard deviation. They answer different questions: the deviation says how far individual samples scattered, the interval says how precisely the average is known. At a thousand iterations the interval is roughly 3% of the deviation, so a large deviation does not mean an imprecise mean.",
    category: "measurement",
  },
  {
    term: "CPU steal time",
    definition:
      "Time the hypervisor took from this virtual machine to give to another. Sustained non-zero steal on a burstable instance means timings were taken while the machine was being throttled.",
    source: { label: "Linux /proc/stat, the `steal` field" },
    category: "measurement",
  },
  {
    term: "Tail ratio",
    definition:
      "Maximum divided by median for one operation — how far the worst observed run strays from the typical one. Publishing only a mean hides this entirely, and for capacity planning the tail is often the number that matters.",
    source: null,
    category: "measurement",
  },

  // --- network -------------------------------------------------------------
  {
    term: "initcwnd",
    aka: ["Initial congestion window"],
    definition:
      "How much data a sender may put on the wire before waiting for an acknowledgement. The common Linux default is ten segments. Exceeding it does not merely make a handshake bigger — it makes it wait, costing a full round trip regardless of available bandwidth.",
    source: { label: "RFC 6928, Increasing TCP's Initial Window" },
    commonlyConfusedWith:
      "A fixed property of the network. It is a tunable per-route default, which is why any verdict about crossing it has to state which value it assumed.",
    category: "network",
  },
  {
    term: "MTU",
    aka: ["Maximum transmission unit"],
    definition:
      "The largest packet a link will carry without fragmenting. Larger post-quantum handshake messages make fragmentation a real possibility where classical ones never approached the limit.",
    source: { label: "RFC 1191, Path MTU Discovery" },
    category: "network",
  },
  {
    term: "Half-open connection",
    definition:
      "A connection where the server has received a SYN and replied, but the handshake has not completed. Each one holds kernel state, so the per-connection cost of that state is a capacity-planning input.",
    source: { label: "RFC 9293, Transmission Control Protocol, connection states" },
    category: "network",
  },

  // --- policy --------------------------------------------------------------
  {
    term: "CNSA 2.0",
    definition:
      "The NSA's Commercial National Security Algorithm Suite 2.0, which names the post-quantum algorithms required for US national security systems and the timeline for adopting them.",
    source: { label: "NSA, Commercial National Security Algorithm Suite 2.0" },
    category: "policy",
  },
  {
    term: "CFDIR",
    definition:
      "A published migration-cost framework structured as fourteen use cases against eleven cost line items, applied per use case rather than system-wide. Q-Shield publishes its coverage against it.",
    source: { label: "CFDIR v.01, dated 2026-06-29" },
    category: "policy",
  },
  {
    term: "Harvest now, decrypt later",
    definition:
      "Capturing encrypted traffic today to decrypt once a cryptanalytically relevant quantum computer exists. It is why data with a long confidentiality lifetime is the migration's first priority, independent of when such a machine actually arrives.",
    source: null,
    category: "policy",
  },
  {
    term: "Crypto-agility",
    definition:
      "The property of being able to change cryptographic algorithms without re-architecting the system that uses them. The migration's real cost tends to sit here rather than in the algorithms themselves.",
    source: null,
    category: "policy",
  },
];

export const CATEGORY_LABEL: Record<GlossaryTerm["category"], string> = {
  algorithm: "Algorithms",
  protocol: "Protocol",
  measurement: "Measurement",
  network: "Network",
  policy: "Policy and threat model",
};

export const CATEGORY_ORDER: GlossaryTerm["category"][] = [
  "algorithm",
  "protocol",
  "measurement",
  "network",
  "policy",
];

/** Terms in one category, alphabetised. */
export function byCategory(category: GlossaryTerm["category"]): GlossaryTerm[] {
  return GLOSSARY.filter((t) => t.category === category).sort((a, b) =>
    a.term.localeCompare(b.term),
  );
}

/**
 * Entries whose claim is not tied to a primary source.
 *
 * Surfaced rather than hidden: the page marks each one, and the count is shown,
 * because a glossary that quietly mixes cited and uncited definitions is
 * exactly the uncited-identity failure the sourcing standard names.
 */
export function unsourced(): GlossaryTerm[] {
  return GLOSSARY.filter((t) => t.source === null);
}

/** A stable anchor id for deep-linking a term. */
export function termAnchor(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
