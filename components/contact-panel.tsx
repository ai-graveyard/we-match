"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Mail, MessageCircle, Phone, X } from "lucide-react";
import { copyText } from "@/components/copy-button";
import { InterestForm, type ConnectionStatus } from "@/components/connection-panel";
import type { ContactFieldKey } from "@/lib/card";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/fmt";
import {
  cardFieldLabel,
  contactActionLabel,
  intentLabel,
} from "@/lib/i18n/labels";
import type { UiDict } from "@/lib/i18n/dict/types";

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
  const className = `flex h-11 w-full items-center justify-center gap-2 rounded-sm px-3 text-sm font-semibold tracking-[0.06em] active:translate-y-px ${
    primary
      ? "bg-accent text-panel"
      : "border border-ink bg-panel text-ink transition-colors duration-100 hover:bg-ink hover:text-panel"
  }`;
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
    <button
      type="button"
      className={className}
      onClick={() => onCopy(channel.value, channel.key)}
    >
      {content}
    </button>
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
}: {
  need: { id: number; type: "need" | "offer"; title: string };
  author: string;
  channels: ContactChannel[];
  preferredContact: ContactFieldKey | null;
  loginHref?: string;
  initialOpen?: boolean;
  interestStatus: ConnectionStatus | null;
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
        className="flex h-11 w-full items-center justify-center rounded-sm bg-accent text-sm font-semibold tracking-[0.06em] text-panel active:translate-y-px"
      >
        {fmt(t.contact.loginTo, { intent })}
      </Link>
    );
  }

  // 既不能举手又没有可见渠道时不留空入口（举手状态在页面的「我的举手」里已有交代）
  if (!canExpressInterest && channels.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-center rounded-sm bg-accent text-sm font-semibold tracking-[0.06em] text-panel active:translate-y-px"
        aria-haspopup="dialog"
      >
        {actionLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-dialog-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 md:items-center md:p-4"
        >
          <section className="max-h-[calc(100dvh-16px)] w-full max-w-[440px] overflow-y-auto rounded-t-md border border-line bg-bg p-4 pb-[calc(24px+var(--safe-b))] text-ink md:rounded-md md:pb-4">
            <header className="flex min-h-11 items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id="contact-dialog-title" className="text-sm font-semibold">
                  {connected
                    ? fmt(t.contact.contactPerson, { name: author })
                    : actionLabel}
                </h2>
                <p className="mt-0.5 truncate font-mono text-3xs text-gray">
                  {fmt(t.contact.about, { title: need.title })}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-line bg-panel text-gray active:bg-bg-3"
                aria-label={t.contact.dialogCloseLabel}
              >
                <X size={16} aria-hidden />
              </button>
            </header>

            {canExpressInterest && (
              <div className="mt-4">
                <InterestForm needId={need.id} label={intent} />
                <p className="mt-2 text-2xs text-gray">
                  {fmt(t.contact.interestHint, { name: author })}
                </p>
              </div>
            )}

            {!canExpressInterest && !connected && (
              <div className="mt-4 rounded-md border border-line bg-panel p-3">
                <p className="text-sm">
                  {fmt(t.contact.waitingTitle, { name: author })}
                </p>
                <p className="mt-1 text-2xs text-gray">
                  {t.contact.waitingBody}
                </p>
              </div>
            )}

            {channels.length > 0 && (
              <>
                {!connected && (
                  <h3 className="mt-4 text-2xs font-semibold tracking-[0.08em] text-gray">
                    {t.contact.alsoDirect}
                  </h3>
                )}
                <div
                  className={`rounded-md border border-line bg-panel p-3 ${
                    connected ? "mt-4" : "mt-2"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-2xs font-semibold tracking-[0.08em] text-gray">
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
                </div>

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
                  <label
                    htmlFor="contact-message"
                    className="text-2xs font-semibold tracking-[0.08em] text-gray"
                  >
                    {t.contact.openerLabel}
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="mt-1 w-full resize-none rounded-sm border border-line bg-panel px-3 py-2 text-sm leading-6 outline-none focus:border-ink"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(message, "message")}
                    className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-sm border border-ink bg-panel text-sm font-semibold tracking-[0.06em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px"
                  >
                    {copied === "message" ? (
                      <Check size={13} aria-hidden />
                    ) : (
                      <Copy size={13} aria-hidden />
                    )}
                    {copied === "message"
                      ? t.contact.openerCopied
                      : t.contact.openerCopy}
                  </button>
                  <p
                    className="mt-2 min-h-5 text-center text-2xs text-gray"
                    aria-live="polite"
                  >
                    {copied === "failed" ? t.common.copyFailedManual : ""}
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
