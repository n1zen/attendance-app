"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { btnSecondary, cardCls, mutedText } from "@/lib/ui";

/** Big scannable QR code for the check-in page. */
export function QrPanel() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const scanUrl = `${window.location.origin}/scan`;
    QRCode.toDataURL(scanUrl, {
      width: 720,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((png) => {
        setUrl(scanUrl);
        setDataUrl(png);
      })
      .catch((err) => {
        console.error("[qr] generation failed:", err);
        setUrl(scanUrl);
        setError(true);
      });
  }, []);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (insecure context); ignore.
    }
  }

  return (
    <section className={`${cardCls} p-5`}>
      <header>
        <h2 className="text-sm font-semibold text-slate-900">
          Attendance QR code
        </h2>
        <p className="text-xs text-slate-400">
          Members scan this to check in
        </p>
      </header>

      <div className="mt-4 flex justify-center">
        {error ? (
          <p className={mutedText}>Could not generate the QR code.</p>
        ) : dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR code linking to ${url}`}
            className="aspect-square w-full max-w-72 rounded-xl border border-slate-200"
          />
        ) : (
          <div className="aspect-square w-full max-w-72 animate-pulse rounded-xl bg-slate-100" />
        )}
      </div>

      <p className="mt-4 truncate rounded-lg bg-slate-50 px-3 py-2 text-center text-xs font-medium text-slate-600">
        {url || "…"}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={copyLink}
          disabled={!url}
          className={btnSecondary}
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className={btnSecondary}>
            Open
          </a>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-400">
        Phones must reach this computer: run{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-slate-600">
          npm run dev:lan
        </code>{" "}
        and open the dashboard via your computer&apos;s local network address.
      </p>
    </section>
  );
}

/** Lightweight live refresh — pulls fresh server components periodically. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        Live · every {seconds}s
      </span>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="font-medium text-indigo-600 transition hover:text-indigo-500"
      >
        Refresh now
      </button>
    </div>
  );
}
