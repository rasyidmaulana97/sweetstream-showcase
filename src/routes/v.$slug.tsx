import { createFileRoute, Link, notFound, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/v/$slug")({
  component: SharePage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-md px-5 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Link unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This share link doesn't exist, has expired, reached its view limit, or was deleted.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Go home
      </Link>
    </main>
  ),
});

type MediaPublic = {
  id: string;
  slug: string;
  original_name: string;
  kind: "video" | "image";
  mime_type: string;
  file_path: string;
  view_count: number;
  max_views: number | null;
  expires_at: string | null;
};

const reportSchema = z.object({
  reason: z.string().trim().min(1, "Pick a reason").max(100),
  details: z.string().trim().max(2000).optional(),
});

const reportReasons = [
  "Non-consensual intimate content",
  "Sexual content involving a minor",
  "Harassment or threats",
  "Copyright infringement",
  "Spam or scam",
  "Other",
];

function SharePage() {
  const { slug } = useParams({ from: "/v/$slug" });
  const [media, setMedia] = useState<MediaPublic | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("media")
        .select(
          "id, slug, original_name, kind, mime_type, file_path, view_count, max_views, expires_at",
        )
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setLoading(false);
        throw notFound();
      }

      const { data: signed, error: signedErr } = await supabase.storage
        .from("media-files")
        .createSignedUrl(data.file_path, 60 * 60); // 1 hour

      if (cancelled) return;
      if (signedErr || !signed) {
        setLoading(false);
        throw notFound();
      }
      setMedia(data as MediaPublic);
      setSignedUrl(signed.signedUrl);
      setLoading(false);

      // Bump view count (fire-and-forget)
      supabase.rpc("increment_media_view", { p_slug: slug }).then(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </main>
    );
  }
  if (!media || !signedUrl) return null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-center bg-black">
          {media.kind === "video" ? (
            <video
              src={signedUrl}
              controls
              playsInline
              className="max-h-[75vh] w-full bg-black"
            />
          ) : (
            <img
              src={signedUrl}
              alt={media.original_name}
              className="max-h-[75vh] w-full object-contain bg-black"
            />
          )}
        </div>
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">
              {media.original_name}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {media.view_count + 1}
              {media.max_views ? ` / ${media.max_views}` : ""} views
              {media.expires_at
                ? ` · expires ${new Date(media.expires_at).toLocaleString()}`
                : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied");
              }}
              className="rounded-full border border-border bg-background px-3.5 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              Copy link
            </button>
            <a
              href={signedUrl}
              download={media.original_name}
              className="rounded-full border border-border bg-background px-3.5 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              Download
            </a>
            <button
              onClick={() => setShowReport(true)}
              className="rounded-full bg-destructive/10 px-3.5 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/20"
            >
              Report
            </button>
          </div>
        </div>
      </div>

      {showReport && (
        <ReportDialog mediaId={media.id} onClose={() => setShowReport(false)} />
      )}
    </main>
  );
}

function ReportDialog({ mediaId, onClose }: { mediaId: string; onClose: () => void }) {
  const [reason, setReason] = useState(reportReasons[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = reportSchema.safeParse({ reason, details: details || undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      media_id: mediaId,
      reason: parsed.data.reason,
      details: parsed.data.details ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report submitted. Thank you.");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground">Report this content</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reports are reviewed. We take non-consensual or illegal content seriously.
        </p>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {reportReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Details (optional)</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={2000}
              rows={4}
              className="mt-1.5 block w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
