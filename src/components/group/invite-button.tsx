"use client";

import * as React from "react";
import { Copy, Share2, Check, UserPlus } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";
import { createInviteAction } from "@/app/actions/invites";

export function InviteButton({
  groupId,
  variant = "outline",
}: {
  groupId: string;
  variant?: "outline" | "default" | "secondary";
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function generate() {
    setPending(true);
    const res = await createInviteAction({ groupId });
    setPending(false);
    if (res.ok && res.inviteUrl) {
      setUrl(res.inviteUrl);
    } else {
      toast(t(res.error ?? "error.generic"), "error");
    }
  }

  function openSheet() {
    setOpen(true);
    if (!url) void generate();
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast(t("common.copied"), "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t("error.generic"), "error");
    }
  }

  async function nativeShare() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "SplitEasy", url });
      } catch {
        /* user cancelled */
      }
    } else {
      void copy();
    }
  }

  const whatsapp = url
    ? `https://wa.me/?text=${encodeURIComponent(url)}`
    : "#";

  return (
    <>
      <Button variant={variant} size="sm" onClick={openSheet}>
        <UserPlus className="h-4 w-4" />
        {t("group.invite")}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("group.invite")}>
        <div className="space-y-4">
          {pending && <p className="text-muted-foreground">{t("common.loading")}</p>}
          {url && (
            <>
              <div className="flex gap-2">
                <Input readOnly value={url} className="text-sm" />
                <Button variant="outline" size="icon" onClick={copy} aria-label={t("common.copy")}>
                  {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={nativeShare}>
                  <Share2 className="h-4 w-4" />
                  {t("common.share")}
                </Button>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="secondary" className="w-full">
                    {t("invite.shareWhatsapp")}
                  </Button>
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("guest.warning")}
              </p>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
