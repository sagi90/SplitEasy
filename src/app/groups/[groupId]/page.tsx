import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { GroupOverview } from "@/components/group/group-overview";
import { getGroupDetail } from "@/lib/queries";
import { getServerLocale } from "@/lib/locale";
import type { Currency } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function GroupPage({
  params,
}: {
  params: { groupId: string };
}) {
  const detail = await getGroupDetail(params.groupId);
  if (!detail) notFound();
  // Keep locale cookie read so the layout dir stays in sync.
  getServerLocale();

  return (
    <main className="min-h-dvh">
      <AppHeader />
      <div className="container max-w-2xl pt-4">
        <GroupOverview
          groupId={detail.group.id}
          groupName={detail.group.name}
          groupEmoji={detail.group.emoji}
          defaultCurrency={detail.group.default_currency as Currency}
          members={detail.members}
          expenses={detail.expenses}
          balances={detail.balancesByCurrency}
          currentMemberId={detail.currentMemberId}
          isOwner={detail.isOwner}
        />
      </div>
    </main>
  );
}
