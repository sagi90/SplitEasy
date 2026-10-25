import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl">🧐</p>
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-muted-foreground">הדף לא נמצא / Page not found</p>
      <Link href="/groups">
        <Button>SplitEasy</Button>
      </Link>
    </main>
  );
}
