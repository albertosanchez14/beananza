import { createFileRoute } from "@tanstack/react-router";
import { IdentifyForm } from "@/views/identify-form";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

type IdentifySearch = {
  returnTo?: string;
};

export const Route = createFileRoute("/identify")({
  validateSearch: (search): IdentifySearch => ({
    returnTo:
      typeof search.returnTo === "string" && search.returnTo.startsWith("/")
        ? search.returnTo
        : undefined,
  }),
  component: IdentifyRoute,
});

function IdentifyRoute() {
  const { returnTo } = Route.useSearch();
  useDocumentTitle("Beananza - Identify");

  return (
    <div
      className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4"
      style={{
        backgroundImage: "url('/fields/field6.jpeg')",
        backgroundSize: "cover",
        backgroundPosition: "bottom",
      }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <IdentifyForm returnTo={returnTo ?? "/room"} />
    </div>
  );
}
