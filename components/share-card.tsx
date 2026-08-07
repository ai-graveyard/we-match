"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Link as LinkIcon, Share2, X } from "lucide-react";
import { toPng } from "html-to-image";
import { QRCodeSVG } from "qrcode.react";
import { LogoMark } from "@/components/logo";
import { BRAND_NAME } from "@/lib/brand";
import { copyText } from "@/components/copy-button";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/fmt";
import { intentLabel, orgVisibilityLabel } from "@/lib/i18n/labels";
import type { UiDict } from "@/lib/i18n/dict/types";

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
  type: "need" | "offer";
  author: string;
  /** 已经按当前语言排好的期限文案（「截止 …」或「永久有效」） */
  meta: string;
  url: string;
};

type OrgShareData = {
  kind: "org";
  name: string;
  description?: string | null;
  visibility: "public" | "private";
  memberCount: number;
  openNeedCount: number;
  url: string;
};

export type ShareCardData = UserShareData | NeedShareData | OrgShareData;

function cleanFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").slice(0, 40) || "we-match";
}

function posterFileName(t: UiDict, data: ShareCardData) {
  if (data.kind === "user") {
    return fmt(t.share.fileUser, { name: cleanFileName(data.nickname) });
  }
  if (data.kind === "need") {
    return fmt(t.share.fileNeed, { name: cleanFileName(data.title) });
  }
  return fmt(t.share.fileOrg, { name: cleanFileName(data.name) });
}

function shareCopy(t: UiDict, data: ShareCardData) {
  if (data.kind === "user") {
    return {
      title: fmt(t.share.copyUserTitle, { name: data.nickname }),
      text: data.bio || fmt(t.share.copyUserText, { name: data.nickname }),
    };
  }
  if (data.kind === "need") {
    return {
      title: fmt(t.share.copyNeedTitle, {
        type: intentLabel(t, data.type),
        title: data.title,
      }),
      text: fmt(t.share.copyNeedText, { name: data.author }),
    };
  }
  return {
    title: fmt(t.share.copyOrgTitle, { name: data.name }),
    text: data.description || fmt(t.share.copyOrgText, { name: data.name }),
  };
}

/** 分享面板标题 / 触发按钮的无障碍名，三种实体各一套 */
function shareLabel(t: UiDict, kind: ShareCardData["kind"]) {
  if (kind === "user") return t.share.openUserLabel;
  if (kind === "need") return t.share.openNeedLabel;
  return t.share.openOrgLabel;
}

// 分享图的画布宽度。html-to-image 是按被截节点的 clientWidth 建 SVG 画布的，
// 而 clientWidth 只有整数：宽度一旦跟着视口走出小数（弹窗内边距、mx-auto 居中
// 都会），画布就比实际排版窄，右边被切掉一条。所以宽度必须写死。
const POSTER_WIDTH = 300;

// 导出成 PNG 的固定画布，不是界面的一部分：宽度、字号、颜色一律写死，不走
// --text-* 与主题令牌。html-to-image 快照的是这一棵树，跟着界面字号阶梯
// 走会让分享图随主题和阶梯调整而变形，且暗色模式下直接烧成黑底。
function Poster({ t, data }: { t: UiDict; data: ShareCardData }) {
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
          {isUser
            ? t.share.posterUser
            : isNeed
              ? t.share.posterNeed
              : t.share.posterOrg}
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
                <h2 className="wrap-anywhere text-[23px] font-semibold leading-tight tracking-[-0.03em]">
                  {data.nickname}
                </h2>
                {data.city && (
                  <p className="mt-1 font-mono text-[11px] text-[#808080]">
                    {data.city}
                  </p>
                )}
              </div>
            </div>
            <p className="mt-6 min-h-11 wrap-break-word text-[14px] leading-6">
              {data.bio || t.share.posterUserFallback}
            </p>
          </>
        ) : isNeed ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                  data.type === "need"
                    ? "bg-[#1a1a1a] text-white"
                    : "border border-[#808080] text-[#808080]"
                }`}
              >
                {data.type === "need"
                  ? t.need.typeNeedShort
                  : t.need.typeOfferShort}
              </span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-[#808080]">
                {intentLabel(t, data.type)}
              </span>
            </div>
            <h2 className="mt-5 wrap-anywhere text-[23px] font-semibold leading-[1.35] tracking-[-0.03em]">
              {data.title}
            </h2>
            <p className="mt-3 min-h-11 wrap-break-word text-[13px] leading-[1.7] text-[#4d4d4d]">
              {data.description
                ? data.description.slice(0, 120)
                : t.share.posterNeedFallback}
              {data.description && data.description.length > 120 ? "…" : ""}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#c9c9c9] pt-3 font-mono text-[10px] text-[#808080]">
              <span className="min-w-0 truncate">{data.author}</span>
              <span className="shrink-0">{data.meta}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-sm bg-[#1a1a1a] text-xs font-semibold text-white">
                {t.share.posterOrgBadge}
              </span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-[#808080]">
                {fmt(t.share.posterOrgKind, {
                  visibility: orgVisibilityLabel(t, data.visibility),
                })}
              </span>
            </div>
            <h2 className="mt-5 wrap-anywhere text-[23px] font-semibold leading-[1.35] tracking-[-0.03em]">
              {data.name}
            </h2>
            <p className="mt-3 min-h-11 wrap-break-word text-[13px] leading-[1.7] text-[#4d4d4d]">
              {data.description
                ? data.description.slice(0, 120)
                : t.share.posterOrgFallback}
              {data.description && data.description.length > 120 ? "…" : ""}
            </p>
            <div className="mt-5 grid grid-cols-2 border-y border-[#c9c9c9] py-3 font-mono text-[10px] text-[#808080]">
              <span>
                {fmt(t.org.overviewMemberCount, { n: data.memberCount })}
              </span>
              <span className="border-l border-[#c9c9c9] pl-4">
                {fmt(t.org.overviewOpenNeedCount, { n: data.openNeedCount })}
              </span>
            </div>
          </>
        )}

        {tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="max-w-full wrap-anywhere rounded-sm border border-[#c9c9c9] px-2 py-1 font-mono text-[10px] text-[#666666]"
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
              ? t.share.posterScanUser
              : isNeed
                ? t.share.posterScanNeed
                : t.share.posterScanOrg}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[#808080]">
            {BRAND_NAME}
            <br />
            {t.brand.slogan}
          </p>
        </div>
      </footer>
    </article>
  );
}

export function ShareCard({ data }: { data: ShareCardData }) {
  const t = useDict();
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
    // 宽度写死成 POSTER_WIDTH，高度按实际渲染向上取整：html-to-image 量的是
    // clientHeight，会把小数行高四舍五入到更小的整数，然后按这个尺寸裁剪画布。
    return toPng(posterRef.current, {
      cacheBust: true,
      pixelRatio: 3,
      backgroundColor: "#f7f7f7",
      width: POSTER_WIDTH,
      height: Math.ceil(posterRef.current.getBoundingClientRect().height),
    });
  }

  async function handleShare() {
    const copy = shareCopy(t, data);
    setBusy("share");
    try {
      if (navigator.share) {
        const dataUrl = await makeImage();
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], posterFileName(t, data), {
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
      showNotice(ok ? t.share.linkCopied : t.common.copyFailedManual);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        const ok = await copyText(data.url);
        showNotice(ok ? t.share.shareAborted : t.share.shareFailed);
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
      link.download = posterFileName(t, data);
      link.href = dataUrl;
      link.click();
      showNotice(t.share.imageSaved);
    } catch {
      showNotice(t.share.saveFailed);
    } finally {
      setBusy(null);
    }
  }

  async function handleCopy() {
    const ok = await copyText(data.url);
    showNotice(ok ? t.share.linkCopied : t.common.copyFailedManual);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm border border-line bg-panel px-3 text-sm font-semibold tracking-[0.06em] text-ink transition-colors duration-100 active:translate-y-px active:bg-bg-3"
        aria-label={shareLabel(t, data.kind)}
      >
        <Share2 size={14} aria-hidden />
        {t.share.open}
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
          <div className="my-auto w-full max-w-[332px] rounded-md border border-line bg-bg p-3 text-ink md:p-4">
          <div className="mb-3 flex h-11 items-center justify-between">
            <div>
              <h2 id="share-dialog-title" className="text-sm font-semibold">
                {shareLabel(t, data.kind)}
              </h2>
              <p className="mt-0.5 font-mono text-2xs text-gray">
                {t.share.dialogHint}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-11 items-center justify-center rounded-sm border border-line bg-panel text-gray transition-colors duration-100 active:bg-bg-3"
              aria-label={t.share.dialogCloseLabel}
            >
              <X size={16} aria-hidden />
            </button>
          </div>

          {/* 屏幕上的预览。窄屏放不下 POSTER_WIDTH 时它会收窄，导出的那份不会。 */}
          <div className="mx-auto w-full max-w-[300px]">
            <Poster t={t} data={data} />
          </div>

          {/* 真正被截图的那棵树：定宽挪到屏幕外，不受弹窗内边距和视口宽度影响。 */}
          <div
            aria-hidden
            className="pointer-events-none fixed top-0 left-[-9999px]"
          >
            <div ref={posterRef} style={{ width: POSTER_WIDTH }}>
              <Poster t={t} data={data} />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2">
            <button
              type="button"
              onClick={handleShare}
              disabled={busy !== null}
              className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-sm bg-ink px-3 text-sm font-semibold tracking-[0.06em] text-panel transition-opacity duration-100 active:translate-y-px disabled:opacity-50"
            >
              <Share2 size={14} aria-hidden />
              {busy === "share" ? t.share.preparing : t.share.shareNow}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy !== null}
              className="flex size-11 items-center justify-center rounded-sm border border-ink bg-panel transition-colors duration-100 active:translate-y-px active:bg-bg-3 disabled:opacity-50"
              aria-label={t.share.saveLabel}
              title={t.share.saveTitle}
            >
              <Download size={15} aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={busy !== null}
              className="flex size-11 items-center justify-center rounded-sm border border-ink bg-panel transition-colors duration-100 active:translate-y-px active:bg-bg-3 disabled:opacity-50"
              aria-label={t.share.copyLinkLabel}
              title={t.share.copyLinkTitle}
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
