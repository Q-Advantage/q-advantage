import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Breadcrumb } from "@/components/chrome/Breadcrumb";
import { GitHubStarPopup } from "@/components/chrome/GitHubStarPopup";
import { ProtocolsView } from "@/components/protocols/ProtocolsView";
import type {
  Manifest,
  TLSComposedFile,
  SigTrackFile,
  SSHComposedFile,
  ProtocolsData,
  ArchBucket,
} from "@/lib/protocols/types";

export const metadata: Metadata = {
  title: "Q-Shield — Protocol benchmarks",
  description:
    "Post-quantum TLS and SSH handshake cost measured in real protocol context: bytes on the wire, phase-by-phase decomposition, cross-checked against liboqs and eBACS. Measured on x86 and ARM. Re-run daily, every number linked to its commit.",
};

function dataDir(): string {
  return path.join(process.cwd(), "public", "data", "protocols");
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function loadData(): ProtocolsData {
  const dir = dataDir();
  const manifestPath = path.join(dir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    return { manifest: null, byArch: {} };
  }

  const manifest = readJson<Manifest>(manifestPath);
  const byArch: Record<string, ArchBucket> = {};

  for (const arch of manifest.arches) {
    byArch[arch] = { tls: null, sig: null, ssh: null };
  }

  for (const entry of Object.values(manifest.files)) {
    const bucket = byArch[entry.arch];
    if (!bucket) continue;
    const filePath = path.join(dir, entry.filename);
    if (!fs.existsSync(filePath)) continue;

    if (entry.track === "tls-composed") {
      bucket.tls = readJson<TLSComposedFile>(filePath);
    } else if (entry.track === "sig-track") {
      bucket.sig = readJson<SigTrackFile>(filePath);
    } else if (entry.track === "ssh-composed") {
      bucket.ssh = readJson<SSHComposedFile>(filePath);
    }
  }

  return { manifest, byArch };
}

export default function ProtocolsPage() {
  const data = loadData();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto max-w-[1200px] px-6 md:px-8 py-10 md:py-12 w-full space-y-10">
        <Breadcrumb back={{ label: "Q-Shield", href: "/q-shield" }} current="Protocols" />

        <div className="flex flex-col gap-3">
          <div className="eyebrow">Q-Shield · Protocol benchmarks</div>
          <h1 className="font-serif text-[clamp(36px,5vw,56px)] font-normal leading-[1.05] tracking-[-0.02em] text-fg">
            The handshake, <em className="italic">in context.</em>
          </h1>
          <p className="text-base text-fg-muted max-w-2xl leading-relaxed font-light">
            Reference benchmarks like eBACS and liboqs measure PQC primitives in
            isolation &mdash; one operation, one cycle count. This is different: it
            shows how post-quantum cryptography actually behaves inside the
            protocols people run every day, TLS and SSH, rather than as raw numbers
            on a spec sheet.
          </p>
          <p className="text-base text-fg-muted max-w-2xl leading-relaxed font-light">
            A handshake isn&apos;t one operation &mdash; it&apos;s key exchange
            composed with authentication, and what actually ships is the whole
            thing: how many microseconds it costs and how many bytes it puts on the
            wire. So that&apos;s what gets measured here. Real suites &mdash;
            X25519+ML-KEM-768, the NIST-curve variant, the classical baseline
            &mdash; decomposed phase by phase, sized to the byte, and cross-checked
            against the liboqs speed tools and eBACS reference cycles so the numbers
            can be verified against the canonical ones. Measured on both x86 (Intel
            Xeon Platinum) and ARM (AWS Graviton3) so the numbers travel. Re-run
            daily; every figure links back to the commit that produced it.
          </p>
        </div>

        <ProtocolsView data={data} />
      </main>
      <Footer />
      <GitHubStarPopup />
    </div>
  );
}
