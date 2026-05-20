import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center text-white">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link
        to="/room"
        className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
      >
        Back to rooms
      </Link>
    </div>
  );
}

export const Route = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFound,
});
