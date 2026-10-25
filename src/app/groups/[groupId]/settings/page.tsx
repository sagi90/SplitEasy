import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { GroupSettingsForm } from "@/components/group/group-settings-form";
import { Button } from "@/components/ui/button";
import { getGroupDetail } from "@/lib/queries";
import { getServerLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function GroupSettingsPage({
  params,
}: {
  params: { groupId: string };
}) {
  const detail = await getGroupDetail(params.groupId);
  if (!detail) notFound();
  const locale = getServerLocale();
  const t = (k: string) => translate(locale, k);

  return (
    <main className="min-h-dvh pb-10">
      <AppHeader />
      <div className="container max-w-2xl space-y-4 pt-4">
        <Link
          href={`/groups/${params.groupId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          {t("common.back")}
        </Link>
        <h1 className="text-2xl font-bold">{t("group.settings")}</h1>

        <Link href={`/groups/${params.groupId}/members`}>
          <Button variant="outline" size="full">
            <Users className="h-4 w-4" />
            {t("group.members")}
          </Button>
        </Link>

        <GroupSettingsForm
          groupId={detail.group.id}
          name={detail.group.name}
          emoji={detail.group.emoji}
          description={detail.group.description}
          isOwner={detail.isOwner}
        />
      </div>
    </main>
  );
}
