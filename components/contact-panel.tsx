"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Mail, MessageCircle, Phone, X } from "lucide-react";
import { copyText } from "@/components/copy-button";
import type { ContactFieldKey } from "@/lib/card";

export type ContactChannel = {
  key: ContactFieldKey;
  label: string;
  value: string;
};

function channelIcon(key: ContactFieldKey) {
  if (key === "email") return <Mail size={14} aria-hidden />;
  if (key === "contactPhone") return <Phone size={14} aria-hidden />;
  return <MessageCircle size={14} aria-hidden />;
}

function channelActionLabel(channel: ContactChannel) {
  if (channel.key === "email") return "写邮件";
  if (channel.key === "contactPhone") return "拨打电话";
  return "复制微信号";
}

function channelHref(
  channel: ContactChannel,
  needTitle: string,
  message: string,
) {
  if (channel.key === "contactPhone") return `tel:${channel.value}`;
  if (channel.key === "email") {
    const subject = `关于「${needTitle}」`;
    return `mailto:${channel.value}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  }
  return null;
}

function ChannelAction({
  channel,
  primary,
  copied,
  needTitle,
  message,
  onCopy,
}: {
  channel: ContactChannel;
  primary: boolean;
  copied: string | null;
  needTitle: string;
  message: string;
  onCopy: (value: string, key: string) => void;
}) {
  const href = channelHref(channel, needTitle, message);
  const className = `flex h-11 w-full items-center justify-center gap-2 rounded-sm px-3 text-xs font-semibold tracking-[0.08em] active:translate-y-px ${
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
      {copied === channel.key ? "已复制" : channelActionLabel(channel)}
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
}: {
  need: { type: "need" | "offer"; title: string };
  author: string;
  channels: ContactChannel[];
  preferredContact: ContactFieldKey | null;
  loginHref?: string;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen && channels.length > 0);
  const [message, setMessage] = useState(() =>
    need.type === "need"
      ? `你好，我在 We Match 看到你发布的「${need.title}」。我可以提供相关帮助，想进一步了解一下具体需求。`
      : `你好，我在 We Match 看到你发布的「${need.title}」。我对此感兴趣，想进一步了解一下具体情况。`,
  );
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const intentLabel = need.type === "need" ? "我能提供" : "我想了解";
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
        className="flex h-11 w-full items-center justify-center rounded-sm bg-accent text-xs font-semibold tracking-[0.08em] text-panel active:translate-y-px"
      >
        登录后{intentLabel}
      </Link>
    );
  }

  if (channels.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-center rounded-sm bg-accent text-xs font-semibold tracking-[0.08em] text-panel active:translate-y-px"
        aria-haspopup="dialog"
      >
        {intentLabel}
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
          <section className="max-h-[calc(100dvh-16px)] w-full max-w-[440px] overflow-y-auto rounded-t-md border border-line bg-bg p-4 pb-6 text-ink md:rounded-md md:pb-4">
            <header className="flex min-h-11 items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id="contact-dialog-title" className="text-sm font-semibold">
                  联系 {author}
                </h2>
                <p className="mt-0.5 truncate font-mono text-[10px] text-gray">
                  关于「{need.title}」
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-11 shrink-0 items-center justify-center rounded-sm border border-line bg-panel text-gray active:bg-bg-3"
                aria-label="关闭联系面板"
              >
                <X size={16} aria-hidden />
              </button>
            </header>

            <div className="mt-4 rounded-md border border-line bg-panel p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold tracking-[0.08em] text-gray">
                  {orderedChannels[0].label}
                </span>
                <span className="font-mono text-[10px] text-gray">优先</span>
              </div>
              <p className="mt-1 truncate font-mono text-[13px]">
                {orderedChannels[0].value}
              </p>
              <div className="mt-3">
                <ChannelAction
                  channel={orderedChannels[0]}
                  primary
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
                className="text-[11px] font-semibold tracking-[0.08em] text-gray"
              >
                联系开场白
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
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-ink bg-panel text-[11px] font-semibold tracking-[0.08em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px"
              >
                {copied === "message" ? (
                  <Check size={13} aria-hidden />
                ) : (
                  <Copy size={13} aria-hidden />
                )}
                {copied === "message" ? "已复制开场白" : "复制开场白"}
              </button>
              <p className="mt-2 min-h-5 text-center text-[11px] text-gray" aria-live="polite">
                {copied === "failed" ? "复制失败，请手动复制" : ""}
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
