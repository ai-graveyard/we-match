import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getAllTags } from "@/lib/queries";
import { CardForm, type CardFormUser } from "@/components/card-form";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "编辑名片" };

export default async function CardEditPage({
  searchParams,
}: PageProps<"/me/card">) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/me/card");
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
        title="编辑名片"
        className="mb-4"
        action={
          <Link
            href={`/u/${user.id}`}
            className="text-xs text-gray hover:text-ink"
          >
            查看对外名片
          </Link>
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
