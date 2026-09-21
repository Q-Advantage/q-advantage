import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { BrandClose } from "@/components/chrome/BrandClose";
import { AnnouncementBar } from "@/components/home/AnnouncementBar";
import { HomepageV3 } from "@/components/home/HomepageV3";
import { getRecentPosts } from "@/lib/blog/posts";
import { getHomeMetrics } from "@/lib/data/home-metrics";
import { formatDuration, formatOpsPerSec } from "@/lib/format";

export default function HomePage() {
  const metrics = getHomeMetrics();
  const posts = getRecentPosts(3).map((post) => ({
    slug: post.slug,
    title: post.title,
    date: post.date,
    category: post.category,
    summary: post.summary,
  }));

  const evidence = {
    date: metrics.run.date,
    commit: metrics.run.shortSha,
    instance: metrics.run.instanceType,
    handshake: metrics.handshake ? formatDuration(metrics.handshake.hybridMeanUs) : "Unavailable",
    throughput: metrics.handshake ? formatOpsPerSec(metrics.handshake.hybridOpsPerSec) : "Unavailable",
    wireDelta: metrics.wire ? `+${metrics.wire.deltaBytes.toLocaleString()} B` : "Unavailable",
    wireRatio: metrics.wire ? `${metrics.wire.ratio.toFixed(1)}×` : "Unavailable",
  };

  return (
    <div className="coldproof-site min-h-screen bg-white text-[#101114]">
      <AnnouncementBar />
      <Header />
      <HomepageV3 evidence={evidence} posts={posts} />
      <Footer />
      <BrandClose />
    </div>
  );
}
