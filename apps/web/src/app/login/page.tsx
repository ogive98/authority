import { Suspense } from "react";
import BusinessLoginPage from "./login-client";

/** Next.js — useSearchParams requires a Suspense boundary. */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-a-surface-1 text-a-fg-muted">
          Chargement…
        </div>
      }
    >
      <BusinessLoginPage />
    </Suspense>
  );
}
