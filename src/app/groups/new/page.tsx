import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { CreateGroupForm } from "@/components/create-group-form";
import { Card, CardContent } from "@/components/ui/card";
import { getServerLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";

export default function NewGroupPage() {
  const locale = getServerLocale();
  const t = (k: string) => translate(locale, k);
  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="container max-w-xl space-y-4 pt-6">
        <Link
          href="/groups"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          {t("common.back")}
        </Link>
        <h1 className="text-2xl font-bold">{t("groups.new")}</h1>
        <Card>
          <CardContent className="pt-6">
            <CreateGroupForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
