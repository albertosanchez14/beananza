import { createFileRoute } from "@tanstack/react-router";
import HomeClient from "@/views/home-client";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  useDocumentTitle("Beananza - Play Now");
  return <HomeClient />;
}
