import { createFileRoute, Link } from "@tanstack/react-router";
import { SignInButtons } from "@/components/pyramid/lobby";
import { RackMark } from "@/components/pyramid/mark";
import { Shell } from "@/components/pyramid/shell";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <Shell>
      <div className="mx-auto flex max-w-md flex-col py-16">
        <RackMark className="h-16 w-20" />
        <h1 className="font-display mt-4 text-5xl italic">Log in</h1>
        <p className="mt-2 mb-6 text-ivory-dim">
          Met Google kom je op de gedeelde piramide. De demo kun je zonder account spelen.
        </p>
        <SignInButtons />
        <Link to="/demo" className="btn btn-ghost mt-3">
          Of speel de demo
        </Link>
        <Link to="/" className="mt-6 text-sm text-ivory-dim">
          Terug naar de tafel
        </Link>
      </div>
    </Shell>
  );
}
