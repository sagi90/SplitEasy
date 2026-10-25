"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl">😵</p>
      <h1 className="text-xl font-bold">משהו השתבש / Something went wrong</h1>
      <Button onClick={reset}>נסה שוב / Retry</Button>
    </main>
  );
}
