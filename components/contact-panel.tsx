"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Link from "next/link";
import { Check, Copy, Mail, MessageCircle, Phone, X } from "lucide-react";
import { copyText } from "@/components/copy-button";
import {
  InterestForm,
  type ConnectionStatus,
  type RaiseQuota,
} from "@/components/connection-panel";
import type { ContactFieldKey } from "@/lib/card";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/fmt";
import {
  cardFieldLabel,
  contactActionLabel,
  intentLabel,
} from "@/lib/i18n/labels";
import type { UiDict } from "@/lib/i18n/dict/types";
import {
  iconBtnLine,
  panel,
  primaryBtn,
  secondaryBtn,
  sectionLabel,
} from "@/lib/ui";

export type ContactChannel = {
  key: ContactFieldKey;
  value: string;
};

function channelIcon(key: ContactFieldKey) {
  if (key === "email") return <Mail size={14} aria-hidden />;
  if (key === "contactPhone") return <Phone size={14} aria-hidden />;
  return <MessageCircle size={14} aria-hidden />;
}

function channelHref(
  t: UiDict,
  channel: ContactChannel,
  needTitle: string,
  message: string,
) {
  if (channel.key === "contactPhone") return `tel:${channel.value}`;
  if (channel.key === "email") {
    const subject = fmt(t.contact.mailSubject, { title: needTitle });
    return `mailto:${channel.value}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  }
  return null;
}

function ChannelAction({
  t,
  channel,
  primary,
  copied,
  needTitle,
  message,
  onCopy,
}: {
  t: UiDict;
  channel: ContactChannel;
  primary: boolean;
  copied: string | null;
  needTitle: string;
  message: string;
  onCopy: (value: string, key: string) => void;
}) {
  const href = channelHref(t, channel, needTitle, message);
  const className = `${primary ? primaryBtn : secondaryBtn} w-full`;
  const content = (
    <>
      {copied === channel.key ? (
        <Check size={14} aria-hidden />
      ) : (
        channelIcon(channel.key)
      )}
      {copied === channel.key
        ? t.common.copied
        : contactActionLabel(t, channel.key)}
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }
  return (
    <Button variant="plain" size="plain"
      type="button"
      className={className}
      onClick={() => onCopy(channel.value, channel.key)}
    >
      {content}
    </Button>
  );
}

export function ContactPanel({
  need,
  author,
  channels,
  preferredContact,
  loginHref,
  initialOpen = false,
  interestStatus,
  contactOptions = [],
  raiseQuota,
}: {
  need: { id: number; type: "need" | "offer"; title: string };
  author: string;
  channels: ContactChannel[];
  preferredContact: ContactFieldKey | null;
  loginHref?: string;
  initialOpen?: boolean;
  interestStatus: ConnectionStatus | null;
  contactOptions?: ContactFieldKey[];
  raiseQuota?: RaiseQuota;
}) {
  const t = useDict();
  const [open, setOpen] = useState(initialOpen);
  const [message, setMessage] = useState(() =>
    fmt(need.type === "need" ? t.contact.openerNeed : t.contact.openerOffer, {
      title: need.title,
    }),
  );
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intent = intentLabel(t, need.type === "need" ? "offer" : "need");
  // 举手被接受即「已连接」；被拒或撤回后可以重新举手
  const connected =
    interestStatus === "accepted" || interestStatus === "completed";
  const canExpressInterest =
    !interestStatus ||
    interestStatus === "rejected" ||
    interestStatus === "cancelled";
  const actionLabel = canExpressInterest ? intent : t.contact.viewContact;
  const orderedChannels = [...channels].sort((a, b) => {
    if (a.key === preferredContact) return -1;
    if (b.key === preferredContact) return 1;
    return 0;
  });

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );


  async function handleCopy(value: string, key: string) {
    const ok = await copyText(value);
    setCopied(ok ? key : "failed");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(null), 2200);
  }

  if (loginHref) {
    return (
      <Link
        href={loginHref}
        className={`${primaryBtn} w-full`}
      >
        {fmt(t.contact.loginTo, { intent })}
      </Link>
    );
  }

  // 既不能举手又没有可见渠道时不留空入口（举手状态在页面的「我的举手」里已有交代）
  if (!canExpressInterest && channels.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
      <Button variant="plain" size="plain"
        type="button"
        onClick={() => setOpen(true)}
        className={`${primaryBtn} w-full`}
        aria-haspopup="dialog"
      >
        {actionLabel}
      </Button>
      </DialogTrigger>

      <DialogContent showCloseButton={false} className="top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-b-none bg-bg p-4 pb-[calc(24px+var(--safe-b))] md:top-1/2 md:bottom-auto md:left-1/2 md:max-w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-md md:pb-4">
            <header className="flex min-h-11 items-center justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold">
                  {connected
                    ? fmt(t.contact.contactPerson, { name: author })
                    : actionLabel}
                </DialogTitle>
                <DialogDescription className="mt-0.5 truncate font-mono text-3xs text-gray">
                  {fmt(t.contact.about, { title: need.title })}
                </DialogDescription>
              </div>
              <Button variant="plain" size="plain"
                  type="button"
                onClick={() => setOpen(false)}
                className={iconBtnLine}
                aria-label={t.contact.dialogCloseLabel}
              >
                <X size={16} aria-hidden />
              </Button>
            </header>

            {canExpressInterest && (
              <div className="mt-4">
                <InterestForm
                  needId={need.id}
                  label={intent}
                  contactOptions={contactOptions}
                  quota={raiseQuota}
                />
                <p className="mt-2 text-2xs text-gray">
                  {fmt(t.contact.interestHint, { name: author })}
                </p>
              </div>
            )}

            {!canExpressInterest && !connected && (
              <Card className={`mt-4 ${panel} p-3`}>
                <p className="text-sm">
                  {fmt(t.contact.waitingTitle, { name: author })}
                </p>
                <p className="mt-1 text-2xs text-gray">
                  {t.contact.waitingBody}
                </p>
              </Card>
            )}

            {channels.length > 0 && (
              <>
                <Card
                  className={`${panel} p-3 mt-4`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={sectionLabel}>
                      {cardFieldLabel(t, orderedChannels[0].key)}
                    </span>
                    <span className="font-mono text-3xs text-gray">
                      {t.contact.preferred}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-mono text-sm">
                    {orderedChannels[0].value}
                  </p>
                  <div className="mt-3">
                    <ChannelAction
                      t={t}
                      channel={orderedChannels[0]}
                      primary={connected}
                      copied={copied}
                      needTitle={need.title}
                      message={message}
                      onCopy={handleCopy}
                    />
                  </div>
                </Card>

                {orderedChannels.length > 1 && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {orderedChannels.slice(1).map((channel) => (
                      <ChannelAction
                        t={t}
                        key={channel.key}
                        channel={channel}
                        primary={false}
                        copied={copied}
                        needTitle={need.title}
                        message={message}
                        onCopy={handleCopy}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-4">
                  <Label
                    htmlFor="contact-message"
                    className={sectionLabel}
                  >
                    {t.contact.openerLabel}
                  </Label>
                  <Textarea
                    id="contact-message"
                    rows={4}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="mt-1 w-full resize-none rounded-sm border border-line bg-panel px-3 py-2 text-sm leading-6 outline-none focus:border-ink"
                  />
                  <Button variant="plain" size="plain"
                    type="button"
                    onClick={() => handleCopy(message, "message")}
                    className={`${secondaryBtn} mt-2 w-full`}
                  >
                    {copied === "message" ? (
                      <Check size={13} aria-hidden />
                    ) : (
                      <Copy size={13} aria-hidden />
                    )}
                    {copied === "message"
                      ? t.contact.openerCopied
                      : t.contact.openerCopy}
                  </Button>
                  <p
                    className="mt-2 min-h-5 text-center text-2xs text-gray"
                    aria-live="polite"
                  >
                    {copied === "failed" ? t.common.copyFailedManual : ""}
                  </p>
                </div>
              </>
            )}
      </DialogContent>
    </Dialog>
  );
}
