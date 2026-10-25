"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";
import {
  renameGroupAction,
  archiveGroupAction,
} from "@/app/actions/groups";

interface Props {
  groupId: string;
  name: string;
  emoji: string | null;
  description: string | null;
  isOwner: boolean;
}

export function GroupSettingsForm({
  groupId,
  name,
  emoji,
  description,
  isOwner,
}: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function save(formData: FormData) {
    formData.set("groupId", groupId);
    setPending(true);
    const res = await renameGroupAction(null, formData);
    setPending(false);
    if (res.ok) {
      toast(t("common.save"), "success");
      router.refresh();
    } else toast(t(res.error ?? "error.generic"), "error");
  }

  async function archive() {
    if (!confirm(t("common.confirm") + "?")) return;
    const res = await archiveGroupAction(groupId);
    if (res.ok) router.push("/groups");
    else toast(t(res.error ?? "error.generic"), "error");
  }

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="py-6 text-muted-foreground">
          {t("error.notAllowed")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <form action={save} className="space-y-4">
          <div className="flex gap-2">
            <div className="w-20 space-y-1.5">
              <Label htmlFor="emoji">😀</Label>
              <Input id="emoji" name="emoji" defaultValue={emoji ?? ""} maxLength={8} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="name">{t("welcome.groupNamePlaceholder")}</Label>
              <Input id="name" name="name" defaultValue={name} required maxLength={80} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">{t("expense.description")}</Label>
            <Input
              id="description"
              name="description"
              defaultValue={description ?? ""}
              maxLength={280}
            />
          </div>
          <Button type="submit" size="full" disabled={pending}>
            {pending ? "…" : t("common.save")}
          </Button>
        </form>

        <div className="border-t border-border pt-4">
          <Button variant="destructive" size="full" onClick={archive}>
            {t("common.delete")} / Archive
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
