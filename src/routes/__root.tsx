import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-semibold tracking-tight text-foreground">404</h1>
        <p className="mt-4 text-base text-muted-foreground">This page doesn't exist.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Driplet — Share videos & photos with expiring links" },
      {
        name: "description",
        content:
          "Sign in, upload a video or photo, and get a clean shareable link that expires when you want it to.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NavBar() {
  const { user, signOut, loading } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <Link to="/" className="text-base font-semibold tracking-tight text-foreground">
          Driplet
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {loading ? null : user ? (
            <>
              <Link
                to="/dashboard"
                className="rounded-full px-3 py-1.5 text-foreground hover:bg-accent"
                activeProps={{ className: "rounded-full px-3 py-1.5 bg-accent text-foreground" }}
              >
                My uploads
              </Link>
              <button
                onClick={signOut}
                className="rounded-full px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-primary px-3.5 py-1.5 text-primary-foreground transition-opacity hover:opacity-90"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function RootComponent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <Outlet />
    </div>
  );
}
