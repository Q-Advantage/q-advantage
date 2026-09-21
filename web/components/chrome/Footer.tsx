import Link from "next/link";

const COLUMNS = [
  { title: "Product", links: [["Migration Model", "/model/how-it-works"], ["PQC Arena", "/pqc-arena"], ["PQC Cost Calculator", "/calculator"], ["P-CBOM", "/p-cbom"]] },
  { title: "Resources", links: [["Research", "/blog"], ["Methodology", "/methodology"], ["Contact", "/contact"]] },
  { title: "Company", links: [["Privacy", "/privacy"], ["GitHub", "https://github.com/Q-Advantage/q-advantage"]] },
];

export function Footer() {
  const year = new Date().getUTCFullYear();
  return <footer className="coldproof-chrome cpv2-footer">
    <div className="cpv2-wrap cpv2-footer-grid">
      <div><Link href="/" className="cpv2-footer-brand">Coldproof</Link><p className="cpv2-footer-note">The financial intelligence platform for the post-quantum transition.</p></div>
      {COLUMNS.map((column) => <div key={column.title}><h3>{column.title}</h3>{column.links.map(([label, href]) => href.startsWith("http")
        ? <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
        : <Link key={label} href={href}>{label}</Link>)}</div>)}
    </div>
    <div className="cpv2-wrap cpv2-footer-bottom"><span>© {year} Coldproof. All rights reserved.</span></div>
  </footer>;
}
