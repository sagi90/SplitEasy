import Link from "next/link";
import { Wallet } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="container flex h-14 max-w-2xl items-center justify-between">
        <Link href="/groups" className="flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </span>
          SplitEasy
        </Link>
        <div className="flex items-center gap-1">
          {children}
          <LanguageToggle />
        </div>
      </div>
    </header>
  );
}
