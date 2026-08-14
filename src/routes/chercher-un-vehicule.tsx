import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/chercher-un-vehicule")({
  component: () => <Outlet />,
});
