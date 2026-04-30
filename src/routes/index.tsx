import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user } = useAuth();
  return (
    <main className="mx-auto max-w-3xl px-5 py-24 sm:py-32">
      <div className="text-center">
        <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          Quiet, expiring, link-only sharing
        </span>
        <h1 className="mt-6 text-balance text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Share a clip. Set when it disappears.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
          Sign in, upload a video or image, and get a clean share link. You choose how long it
          lives and how many times it can be opened.
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Link
            to={user ? "/dashboard" : "/signup"}
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {user ? "Go to my uploads" : "Get started"}
          </Link>
          <Link
            to={user ? "/dashboard" : "/login"}
            className="rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {user ? "Upload something" : "Sign in"}
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-24 grid max-w-2xl grid-cols-1 gap-5 sm:grid-cols-3">
        {[
          { t: "You set the expiry", d: "1, 7, or 30 days. Or cap by view count." },
          { t: "Shareable anywhere", d: "Anyone with the link can watch — no account needed." },
          { t: "You stay in control", d: "Delete anytime. Disabled links return 404." },
        ].map((f) => (
          <div
            key={f.t}
            className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm"
          >
            <div className="text-sm font-semibold text-foreground">{f.t}</div>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
