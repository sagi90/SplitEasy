"use client";

import * as React from "react";
import { Copy, Check, UserPlus, Link2, X, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import {
  addPlaceholderAction,
  createClaimAction,
  removeMemberAction,
  resolveJoinRequestAction,
} from "@/app/actions/members";
import { revokeInviteAction } from "@/app/actions/invites";
import type { MemberView, InviteRow } from "@/lib/queries";

interface JoinRequest {
  id: string;
  requested_display_name: string;
  status: string;
  created_at: string;
}

interface Props {
  groupId: string;
  isOwner: boolean;
  members: MemberView[];
  invites: InviteRow[];
  joinRequests: JoinRequest[];
}

export function MembersView({
  groupId,
  isOwner,
  members,
  invites,
  joinRequests,
}: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [newName, setNewName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [claimUrl, setClaimUrl] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function addPlaceholder() {
    if (!newName.trim()) return;
    setPending(true);
    const res = await addPlaceholderAction({ groupId, displayName: newName.trim() });
    setPending(false);
    if (res.ok) {
      setNewName("");
      toast(t("member.addPlaceholder"), "success");
      router.refresh();
    } else {
      toast(t(res.error ?? "error.generic"), "error");
    }
  }

  async function makeClaim(memberId: string) {
    const res = await createClaimAction({ groupId, memberId });
    if (res.ok && res.claimUrl) {
      setClaimUrl(res.claimUrl);
    } else {
      toast(t(res.error ?? "error.generic"), "error");
    }
  }

  async function remove(memberId: string) {
    if (!confirm(t("member.remove") + "?")) return;
    const res = await removeMemberAction(memberId, groupId);
    if (res.ok) {
      toast(t("member.remove"), "success");
      router.refresh();
    } else toast(t(res.error ?? "error.generic"), "error");
  }

  async function revoke(inviteId: string) {
    const res = await revokeInviteAction(inviteId, groupId);
    if (res.ok) {
      toast("OK", "success");
      router.refresh();
    } else toast(t(res.error ?? "error.generic"), "error");
  }

  async function resolveRequest(id: string, approve: boolean) {
    const res = await resolveJoinRequestAction(id, approve, groupId);
    if (res.ok) router.refresh();
    else toast(t(res.error ?? "error.generic"), "error");
  }

  async function copyClaim() {
    if (!claimUrl) return;
    await navigator.clipboard.writeText(claimUrl);
    setCopied(true);
    toast(t("common.copied"), "success");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Pending join requests */}
      {isOwner && joinRequests.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("invite.pending")}
            </h2>
            {joinRequests.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="flex-1 truncate">{r.requested_display_name}</span>
                <Button size="sm" onClick={() => resolveRequest(r.id, true)}>
                  {t("common.confirm")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => resolveRequest(r.id, false)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      <Card>
        <CardContent className="space-y-2 pt-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("group.members")}
          </h2>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                  {m.display_name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.display_name}
                    {m.isCurrentUser ? ` (${t("member.you")})` : ""}
                  </p>
                  <div className="flex gap-1">
                    {m.role === "owner" && (
                      <Badge variant="success">
                        <Shield className="me-1 h-3 w-3" />
                        {t("member.owner")}
                      </Badge>
                    )}
                    {m.isPlaceholder && (
                      <Badge variant="muted">{t("member.placeholder")}</Badge>
                    )}
                    {m.status === "inactive" && (
                      <Badge variant="destructive">{t("member.inactive")}</Badge>
                    )}
                  </div>
                </div>
                {isOwner && m.isPlaceholder && m.status === "active" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => makeClaim(m.id)}
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                )}
                {isOwner && m.role !== "owner" && m.status === "active" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(m.id)}
                    aria-label={t("member.remove")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {isOwner && (
            <div className="flex gap-2 pt-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={60}
                placeholder={t("member.addPlaceholder")}
              />
              <Button onClick={addPlaceholder} disabled={pending}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invites */}
      {isOwner && invites.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t("group.invite")}
            </h2>
            <ul className="space-y-2 text-sm">
              {invites.map((inv) => {
                const expired =
                  !!inv.revoked_at ||
                  (inv.expires_at ? new Date(inv.expires_at) < new Date() : false) ||
                  (inv.max_uses !== null && inv.use_count >= inv.max_uses);
                return (
                  <li key={inv.id} className="flex items-center gap-2">
                    <span className="flex-1 text-muted-foreground">
                      {inv.use_count}
                      {inv.max_uses ? `/${inv.max_uses}` : ""} ·{" "}
                      {expired ? t("invite.expired") : "✓"}
                    </span>
                    {!expired && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => revoke(inv.id)}
                      >
                        {t("member.remove")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Sheet
        open={!!claimUrl}
        onClose={() => setClaimUrl(null)}
        title={t("claim.title")}
      >
        {claimUrl && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={claimUrl} className="text-sm" />
              <Button variant="outline" size="icon" onClick={copyClaim}>
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("claim.title")} — {t("guest.warning")}
            </p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
