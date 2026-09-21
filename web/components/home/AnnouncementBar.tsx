"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "coldproof-announcement-dismissed";

export function AnnouncementBar() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(window.sessionStorage.getItem(STORAGE_KEY) !== "true");
  }, []);

  if (!visible) return null;

  return (
    <aside className="cp-announcement" aria-label="Announcement">
      <div className="cp-announcement-inner">
        <p>
          We’re working with a small number of organizations on post-quantum migration models.
          <Link href="/contact">Learn more <span aria-hidden>→</span></Link>
        </p>
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={() => {
            window.sessionStorage.setItem(STORAGE_KEY, "true");
            setVisible(false);
          }}
        >
          <X aria-hidden />
        </button>
      </div>
    </aside>
  );
}
