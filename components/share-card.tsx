"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Link as LinkIcon, Share2, X } from "lucide-react";
import { toPng } from "html-to-image";
import { QRCodeSVG } from "qrcode.react";
import { LogoMark } from "@/components/logo";
import { BRAND_NAME, BRAND_SLOGAN } from "@/lib/brand";
import { copyText } from "@/components/copy-button";

type UserShareData = {
  kind: "user";
  nickname: string;
  bio?: string | null;
  city?: string | null;
  tags: string[];
  url: string;
};

type NeedShareData = {
  kind: "need";
  title: string;
  description?: string | null;
  tags: string[];
  typeLabel: string;
  author: string;
  meta: string;
  url: string;
};

type OrgShareData = {
  kind: "org";
  name: string;
  description?: string | null;
  visibilityLabel: string;
  memberCount: number;
  openNeedCount: number;
  url: string;
};

export type ShareCardData = UserShareData | NeedShareData | OrgShareData;

function cleanFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").slice(0, 40) || "we-match";
}

function posterFileName(data: ShareCardData) {
  if (data.kind === "user") {
    return `${cleanFileName(data.nickname)}-名片.png`;
  }
  if (data.kind === "need") {
    return `${cleanFileName(data.title)}-需求.png`;
  }
  return `${cleanFileName(data.name)}-组织邀请.png`;
}

function shareCopy(data: ShareCardData) {
  if (data.kind === "user") {
    return {
      title: `${data.nickname}的名片 · We Match`,
      text: data.bio || `查看 ${data.nickname} 的 We Match 名片`,
    };
  }
  if (data.kind === "need") {
    return {
      title: `${data.typeLabel}｜${data.title}`,
      text: `${data.author} 在 We Match 发布了这条需求`,
    };
  }
  return {
    title: `邀请你加入 ${data.name} · We Match`,
    text: data.description || `扫码查看 ${data.name} 并申请加入`,
  };
}

// 导出成 PNG 的固定画布，不是界面的一部分：字号、颜色一律写死，不走
// --text-* 与主题令牌。html-to-image 快照的是这一棵树，跟着界面字号阶梯
// 走会让分享图随主题和阶梯调整而变形，且暗色模式下直接烧成黑底。
function Poster({ data }: { data: ShareCardData }) {
  const isUser = data.kind === "user";
  const isNeed = data.kind === "need";
  const tags = data.kind === "org" ? [] : data.tags.slice(0, 6);

  return (
    <article className="overflow-hidden rounded-md border border-[#1a1a1a] bg-[#f7f7f7] font-sans text-[#1a1a1a]">
      <header className="flex h-14 items-center justify-between border-b border-[#c9c9c9] px-5">
        <div className="flex items-center gap-2 text-[13px] font-bold tracking-[-0.02em]">
          <LogoMark height={14} />
          We Match
        </div>
        <span className="font-mono text-[10px] tracking-[0.12em] text-[#808080]">
          {isUser ? "USER CARD" : isNeed ? "MATCH REQUEST" : "ORGANIZATION"}
        </span>
      </header>

      <div className="px-5 py-6">
        {isUser ? (
          <>
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-sm bg-[#ececec] font-mono text-xl font-semibold">
                {data.nickname.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-[23px] font-semibold leading-tight tracking-[-0.03em]">
                  {data.nickname}
                </h2>
                {data.city && (
                  <p className="mt-1 font-mono text-[11px] text-[#808080]">
                    {data.city}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-6 min-h-11 text-[14px] leading-6">
              {data.bio || "很高兴认识你，扫码查看我的完整名片。"}
            </p>
          </>
        ) : isNeed ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                  data.typeLabel === "我需要"
                    ? "bg-[#1a1a1a] text-white"
                    : "border border-[#808080] text-[#808080]"
                }`}
              >
                {data.typeLabel === "我需要" ? "需" : "供"}
              </span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-[#808080]">
                {data.typeLabel}
              </span>
            </div>
            <h2 className="mt-5 text-[23px] font-semibold leading-[1.35] tracking-[-0.03em]">
              {data.title}
            </h2>
            <p className="mt-3 min-h-11 text-[13px] leading-[1.7] text-[#4d4d4d]">
              {data.description
                ? data.description.slice(0, 120)
                : "扫码查看需求详情，找到合适的人一起完成。"}
              {data.description && data.description.length > 120 ? "…" : ""}
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-[#c9c9c9] pt-3 font-mono text-[10px] text-[#808080]">
              <span>{data.author}</span>
              <span>{data.meta}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-sm bg-[#1a1a1a] text-xs font-semibold text-white">
                组
              </span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-[#808080]">
                {data.visibilityLabel}组织
              </span>
            </div>
            <h2 className="mt-5 text-[23px] font-semibold leading-[1.35] tracking-[-0.03em]">
              {data.name}
            </h2>
            <p className="mt-3 min-h-11 text-[13px] leading-[1.7] text-[#4d4d4d]">
              {data.description
                ? data.description.slice(0, 120)
                : "欢迎加入组织，和合适的人交换需求、经验与机会。"}
              {data.description && data.description.length > 120 ? "…" : ""}
            </p>
            <div className="mt-5 grid grid-cols-2 border-y border-[#c9c9c9] py-3 font-mono text-[10px] text-[#808080]">
              <span>{data.memberCount} 名成员</span>
              <span className="border-l border-[#c9c9c9] pl-4">
                {data.openNeedCount} 条开放需求
              </span>
            </div>
          </>
        )}

        {tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm border border-[#c9c9c9] px-2 py-1 font-mono text-[10px] text-[#666666]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <footer className="flex items-center gap-4 border-t border-[#c9c9c9] bg-white px-5 py-5">
        <QRCodeSVG
          value={data.url}
          size={88}
          level="M"
          marginSize={1}
          bgColor="#ffffff"
          fgColor="#1a1a1a"
          className="shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {isUser
              ? "扫码查看完整名片"
              : isNeed
                ? "扫码查看需求详情"
                : "扫码查看并申请加入"}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[#808080]">
            {BRAND_NAME}
            <br />
            {BRAND_SLOGAN}
          </p>
        </div>
      </footer>
    </article>
  );
}

export function ShareCard({ data }: { data: ShareCardData }) {
  const posterRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"share" | "save" | null>(null);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
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

  function showNotice(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 2200);
  }

  async function makeImage() {
    if (!posterRef.current) throw new Error("Poster is not ready");
    return toPng(posterRef.current, {
      cacheBust: true,
      pixelRatio: 3,
      backgroundColor: "#f7f7f7",
    });
  }

  async function handleShare() {
    const copy = shareCopy(data);
    setBusy("share");
    try {
      if (navigator.share) {
        const dataUrl = await makeImage();
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], posterFileName(data), {
          type: "image/png",
        });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: copy.title,
            text: `${copy.text}\n${data.url}`,
            files: [file],
          });
        } else {
          await navigator.share({ ...copy, url: data.url });
        }
        return;
      }
      const ok = await copyText(data.url);
      showNotice(ok ? "链接已复制" : "复制失败，请手动复制");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        const ok = await copyText(data.url);
        showNotice(ok ? "分享未完成，链接已复制" : "分享失败，请重试");
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    setBusy("save");
    try {
      const dataUrl = await makeImage();
      const link = document.createElement("a");
      link.download = posterFileName(data);
      link.href = dataUrl;
      link.click();
      showNotice("图片已保存");
    } catch {
      showNotice("保存失败，请重试");
    } finally {
      setBusy(null);
    }
  }

  async function handleCopy() {
    const ok = await copyText(data.url);
    showNotice(ok ? "链接已复制" : "复制失败，请手动复制");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm border border-line bg-panel px-3 text-sm font-semibold tracking-[0.06em] text-ink transition-colors duration-100 active:translate-y-px active:bg-bg-3"
        aria-label={
          data.kind === "user"
            ? "分享名片"
            : data.kind === "need"
              ? "分享需求"
              : "分享组织"
        }
      >
        <Share2 size={14} aria-hidden />
        分享
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-dialog-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
        >
          <div className="my-auto w-full max-w-[392px] rounded-md border border-line bg-bg p-3 text-ink md:p-4">
          <div className="mb-3 flex h-11 items-center justify-between">
            <div>
              <h2 id="share-dialog-title" className="text-sm font-semibold">
                {data.kind === "user"
                  ? "分享名片"
                  : data.kind === "need"
                    ? "分享需求"
                    : "分享组织"}
              </h2>
              <p className="mt-0.5 font-mono text-2xs text-gray">
                图片底部二维码可直接扫码
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-11 items-center justify-center rounded-sm border border-line bg-panel text-gray transition-colors duration-100 active:bg-bg-3"
              aria-label="关闭分享面板"
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          <div ref={posterRef} className="mx-auto w-full max-w-[360px]">
            <Poster data={data} />
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2">
            <button
              type="button"
              onClick={handleShare}
              disabled={busy !== null}
              className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-sm bg-ink px-3 text-sm font-semibold tracking-[0.06em] text-panel transition-opacity duration-100 active:translate-y-px disabled:opacity-50"
            >
              <Share2 size={14} aria-hidden />
              {busy === "share" ? "正在准备图片…" : "立即分享"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy !== null}
              className="flex size-11 items-center justify-center rounded-sm border border-ink bg-panel transition-colors duration-100 active:translate-y-px active:bg-bg-3 disabled:opacity-50"
              aria-label="保存分享图片"
              title="保存图片"
            >
              <Download size={15} aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={busy !== null}
              className="flex size-11 items-center justify-center rounded-sm border border-ink bg-panel transition-colors duration-100 active:translate-y-px active:bg-bg-3 disabled:opacity-50"
              aria-label="复制分享链接"
              title="复制链接"
            >
              <LinkIcon size={15} aria-hidden />
            </button>
          </div>
          <p className="mt-2 min-h-5 text-center text-3xs text-gray" aria-live="polite">
            {notice}
          </p>
        </div>
        </div>
      )}
    </>
  );
}
