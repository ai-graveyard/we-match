import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getAllTags } from "@/lib/queries";
import { CardForm, type CardFormUser } from "@/components/card-form";
import { PageHeader } from "@/components/page-header";
import { getDict, getLocale } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import { LocaleLink } from "@/lib/i18n/link";
import { localePath } from "@/lib/i18n/routing";

export const generateMetadata = pageTitle((t) => t.card.metaEdit);

export default async function CardEditPage({
  searchParams,
}: PageProps<"/[lang]/me/card">) {
  const t = await getDict();
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) redirect(localePath(locale, "/login?next=/me/card"));
  const params = await searchParams;
  const suggestions = await getAllTags();

  const formUser: CardFormUser = {
    nickname: user.nickname,
    bio: user.bio ?? "",
    city: user.city ?? "",
    tags: user.tags,
    wechat: user.wechat ?? "",
    email: user.email ?? "",
    contactPhone: user.contactPhone ?? "",
    weixinMp: user.weixinMp ?? "",
    weixinChannels: user.weixinChannels ?? "",
    xiaohongshu: user.xiaohongshu ?? "",
    weibo: user.weibo ?? "",
    fieldVisibility: user.fieldVisibility,
  };

  return (
    <div>
      <PageHeader
        title={t.card.metaEdit}
        className="mb-4"
        action={
          <LocaleLink
            href={`/u/${user.id}`}
            className="text-xs text-gray hover:text-ink"
          >
            {t.card.viewPublicCard}
          </LocaleLink>
        }
      />
      <CardForm
        user={formUser}
        suggestions={suggestions}
        welcome={params.welcome === "1"}
      />
    </div>
  );
}
