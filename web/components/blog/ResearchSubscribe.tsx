import Link from "next/link";
import { SubscribeForm } from "@/components/chrome/SubscribeForm";

export function ResearchSubscribe() {
  const configured = !!process.env.BEEHIIV_API_KEY && !!process.env.BEEHIIV_PUB_ID;
  return <aside className="research-subscribe"><div><span className="cp-mono">Follow the evidence</span><h2>Research worth returning to.</h2><p>Follow Coldproof’s technical and economic research on the post-quantum transition.</p></div><div>{configured ? <SubscribeForm /> : <p>Online subscriptions are currently unavailable. <Link className="text-link underline" href="/contact">Contact Coldproof about research updates →</Link></p>}<p className="mt-3 text-xs text-fg-muted"><Link href="/privacy">Privacy policy</Link></p></div></aside>;
}
