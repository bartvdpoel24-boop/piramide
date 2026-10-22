import { createFileRoute } from "@tanstack/react-router";
import { Lobby } from "@/components/pyramid/lobby";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Lobby />;
}
