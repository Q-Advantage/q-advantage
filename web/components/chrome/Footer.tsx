export function Footer() {
  const year = new Date().getUTCFullYear();
  return (
    <footer className="border-t border-border pt-12 pb-10">
      <div className="mx-auto max-w-[1200px] px-8 md:px-8 px-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex items-center gap-4 font-mono text-2xs text-fg-subtle tracking-eyebrow flex-wrap">
            <span>© {year} Q-Advantage</span>
            <span>·</span>
            <span>Built in public</span>
            <span>·</span>
            <span>All rights reserved</span>
          </div>
          <div className="flex gap-6 flex-wrap">
            <a
              href="https://github.com/Q-Advantage"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-fg-muted hover:text-fg transition-colors"
            >
              GitHub
            </a>
            <a
              href="/about"
              className="text-sm text-fg-muted hover:text-fg transition-colors"
            >
              About
            </a>
            <a
              href="/methodology"
              className="text-sm text-fg-muted hover:text-fg transition-colors"
            >
              Methodology
            </a>
            <a
              href="/privacy"
              className="text-sm text-fg-muted hover:text-fg transition-colors"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
