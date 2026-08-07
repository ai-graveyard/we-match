import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ListEnd } from "@/components/list-states";
import { getDict, getLocale, getServerDict } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import { localePath } from "@/lib/i18n/routing";
import { relativeTime } from "@/lib/i18n/labels";
import { notificationText } from "@/lib/notifications";

export const generateMetadata = pageTitle((t) => t.notifications.metaTitle);
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const t = await getDict();
  // 通知正文存的是 type + params，这里按当前语言现渲染
  const serverDict = await getServerDict();
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) redirect(localePath(locale, "/login?next=/notifications"));
  const list = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  const unread = list.filter((item) => !item.readAt).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <PageHeader title={t.notifications.metaTitle} />
        {unread > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button className="text-2xs text-gray underline">
              {t.notifications.markAllRead}
            </button>
          </form>
        )}
      </div>
      {list.length === 0 ? (
        <EmptyState>{t.notifications.empty}</EmptyState>
      ) : (
        <>
        <div className="mt-4 rounded-md border border-line bg-panel">
          {list.map((item, index) => {
            const text = notificationText(serverDict, item);
            return (
            <form
              key={item.id}
              action={markNotificationReadAction}
              className={index > 0 ? "border-t border-line" : ""}
            >
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="href" value={item.href ?? ""} />
              <button className="flex w-full items-start gap-3 p-4 text-left hover:bg-bg-3">
                <span
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                    item.readAt ? "bg-line" : "bg-accent"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {text.title}
                  </span>
                  {text.body && (
                    <span className="mt-1 block text-xs leading-5 text-gray">
                      {text.body}
                    </span>
                  )}
                  <span className="mt-1 block font-mono text-3xs text-gray">
                    {relativeTime(t, item.createdAt)}
                  </span>
                </span>
              </button>
            </form>
            );
          })}
        </div>
        <ListEnd />
        </>
      )}
    </div>
  );
}
