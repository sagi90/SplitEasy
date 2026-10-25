import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MembersView } from "@/components/group/members-view";
import {
  getGroupDetail,
  getGroupInvites,
  getPendingJoinRequests,
} from "@/lib/queries";
import { getServerLocale } from "@/lib/locale";
import { translate } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  params,
}: {
  params: { groupId: string };
}) {
  const detail = await getGroupDetail(params.groupId);
  if (!detail) notFound();
  const locale = getServerLocale();
  const t = (k: string) => translate(locale, k);

  const [invites, joinRequests] = detail.isOwner
    ? await Promise.all([
        getGroupInvites(params.groupId),
        getPendingJoinRequests(params.groupId),
      ])
    : [[], []];

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
        <h1 className="text-2xl font-bold">{t("group.members")}</h1>
        <MembersView
          groupId={params.groupId}
          isOwner={detail.isOwner}
          members={detail.members}
          invites={invites}
          joinRequests={joinRequests}
        />
      </div>
    </main>
  );
}
