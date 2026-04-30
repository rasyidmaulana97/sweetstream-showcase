import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateSlug } from "@/lib/slug";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const ALLOWED_VIDEO = ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"];
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 100 * 1024 * 1024;

const expiryOptions = [
  { id: "1d", label: "1 day", days: 1 },
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "never", label: "No date limit", days: null },
] as const;

const viewOptions = [
  { id: "any", label: "Unlimited", views: null },
  { id: "10", label: "10 views", views: 10 },
  { id: "100", label: "100 views", views: 100 },
  { id: "1000", label: "1,000 views", views: 1000 },
] as const;

type Media = {
  id: string;
  slug: string;
  original_name: string;
  kind: "video" | "image";
  mime_type: string;
  size_bytes: number;
  expires_at: string | null;
  max_views: number | null;
  view_count: number;
  is_disabled: boolean;
  file_path: string;
  created_at: string;
};

const uploadSchema = z.object({
  expiryId: z.enum(["1d", "7d", "30d", "never"]),
  viewsId: z.enum(["any", "10", "100", "1000"]),
});

function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Media[]>([]);
  const [fetching, setFetching] = useState(true);

  // upload form
  const [file, setFile] = useState<File | null>(null);
  const [expiryId, setExpiryId] = useState<(typeof expiryOptions)[number]["id"]>("7d");
  const [viewsId, setViewsId] = useState<(typeof viewOptions)[number]["id"]>("any");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const loadItems = async () => {
    if (!user) return;
    setFetching(true);
    const { data, error } = await supabase
      .from("media")
      .select(
        "id, slug, original_name, kind, mime_type, size_bytes, expires_at, max_views, view_count, is_disabled, file_path, created_at",
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setItems(data as Media[]);
    }
    setFetching(false);
  };

  useEffect(() => {
    if (user) loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fileKind = useMemo<"video" | "image" | null>(() => {
    if (!file) return null;
    if (ALLOWED_VIDEO.includes(file.type)) return "video";
    if (ALLOWED_IMAGE.includes(file.type)) return "image";
    return null;
  }, [file]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file) return;
    if (file.size > MAX_BYTES) {
      toast.error("Files must be 100 MB or smaller");
      return;
    }
    if (!fileKind) {
      toast.error("Unsupported file type. Use MP4/MOV/WebM/MKV or JPG/PNG/WebP/GIF.");
      return;
    }
    const parsed = uploadSchema.safeParse({ expiryId, viewsId });
    if (!parsed.success) {
      toast.error("Invalid options");
      return;
    }

    setUploading(true);
    try {
      const slug = generateSlug(10);
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
      const path = `${user.id}/${slug}${ext ? `.${ext}` : ""}`;

      const { error: upErr } = await supabase.storage
        .from("media-files")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (upErr) throw upErr;

      const days = expiryOptions.find((o) => o.id === expiryId)!.days;
      const max = viewOptions.find((o) => o.id === viewsId)!.views;
      const expires_at = days
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error: dbErr } = await supabase.from("media").insert({
        owner_id: user.id,
        slug,
        original_name: file.name.slice(0, 255),
        file_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        kind: fileKind,
        expires_at,
        max_views: max,
      });
      if (dbErr) {
        // try to clean up storage on db failure
        await supabase.storage.from("media-files").remove([path]);
        throw dbErr;
      }

      toast.success("Uploaded");
      setFile(null);
      (document.getElementById("file-input") as HTMLInputElement | null)?.value &&
        ((document.getElementById("file-input") as HTMLInputElement).value = "");
      loadItems();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (m: Media) => {
    if (!confirm(`Delete "${m.original_name}"? The share link will stop working.`)) return;
    const { error: stErr } = await supabase.storage.from("media-files").remove([m.file_path]);
    if (stErr) {
      toast.error(stErr.message);
      return;
    }
    const { error: dbErr } = await supabase.from("media").delete().eq("id", m.id);
    if (dbErr) {
      toast.error(dbErr.message);
      return;
    }
    toast.success("Deleted");
    setItems((s) => s.filter((x) => x.id !== m.id));
  };

  const copyLink = async (slug: string) => {
    const url = `${window.location.origin}/v/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  if (loading || !user) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-16">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">My uploads</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Signed in as {user.email}. Files up to 100 MB.
      </p>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Upload a new file</h2>
        <form onSubmit={handleUpload} className="mt-4 space-y-5">
          <div>
            <label htmlFor="file-input" className="text-sm font-medium text-foreground">
              File
            </label>
            <input
              id="file-input"
              type="file"
              accept={[...ALLOWED_VIDEO, ...ALLOWED_IMAGE].join(",")}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full rounded-xl border border-dashed border-input bg-background px-3 py-3 text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-secondary-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              MP4, MOV, WebM, MKV — or JPG, PNG, WebP, GIF.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-foreground">Link expires after</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {expiryOptions.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setExpiryId(o.id)}
                    className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                      expiryId === o.id
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-foreground hover:bg-accent"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">View limit</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {viewOptions.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setViewsId(o.id)}
                    className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                      viewsId === o.id
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-foreground hover:bg-accent"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading || !file}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">Your files</h2>
        {fetching ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No uploads yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((m) => {
              const isExpired = m.expires_at && new Date(m.expires_at).getTime() < Date.now();
              const isCapped = m.max_views !== null && m.view_count >= m.max_views;
              const dead = m.is_disabled || isExpired || isCapped;
              return (
                <li
                  key={m.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {m.original_name}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {m.kind}
                      </span>
                      {dead && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                          {m.is_disabled ? "disabled" : isExpired ? "expired" : "view-cap reached"}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      /v/{m.slug} · {m.view_count}
                      {m.max_views ? ` / ${m.max_views}` : ""} views
                      {m.expires_at
                        ? ` · expires ${new Date(m.expires_at).toLocaleString()}`
                        : " · no date limit"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => copyLink(m.slug)}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      Copy link
                    </button>
                    <Link
                      to="/v/$slug"
                      params={{ slug: m.slug }}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      Open
                    </Link>
                    <button
                      onClick={() => handleDelete(m)}
                      className="rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
