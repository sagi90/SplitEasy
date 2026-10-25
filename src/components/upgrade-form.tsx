"use client";

import * as React from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";
import {
  upgradeWithEmailAction,
  upgradeWithGoogleAction,
} from "@/app/actions/account";

export function UpgradeForm() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function sendEmail() {
    if (!email) return;
    setPending(true);
    const res = await upgradeWithEmailAction({ email });
    setPending(false);
    if (res.ok) setMessage(res.message ?? null);
    else toast(res.error ?? t("error.generic"), "error");
  }

  async function withGoogle() {
    setPending(true);
    const res = await upgradeWithGoogleAction();
    setPending(false);
    if (res.ok && res.url) {
      window.location.href = res.url;
    } else {
      toast(res.error ?? t("error.generic"), "error");
    }
  }

  if (message) {
    return (
      <p className="rounded-lg bg-accent p-4 text-center text-accent-foreground">
        {message}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("upgrade.body")}</p>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("upgrade.email")}</Label>
        <div className="flex gap-2">
          <Input
            id="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Button onClick={sendEmail} disabled={pending}>
            <Mail className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="relative py-1 text-center text-xs text-muted-foreground">
        —
      </div>
      <Button variant="outline" size="full" onClick={withGoogle} disabled={pending}>
        {t("upgrade.google")}
      </Button>
    </div>
  );
}
