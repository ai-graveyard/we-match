import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ListEnd } from "@/components/list-states";

export const metadata = { title: "通知" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/notifications");
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
        <PageHeader title="通知" />
        {unread > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button className="text-[11px] text-gray underline">全部已读</button>
          </form>
        )}
      </div>
      {list.length === 0 ? (
        <EmptyState>暂时没有通知</EmptyState>
      ) : (
        <>
        <div className="mt-4 rounded-md border border-line bg-panel">
          {list.map((item, index) => (
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
                  <span className="block text-sm font-semibold">{item.title}</span>
                  {item.body && (
                    <span className="mt-1 block text-xs leading-5 text-gray">
                      {item.body}
                    </span>
                  )}
                  <span className="mt-1 block font-mono text-[10px] text-gray">
                    {relativeTime(item.createdAt)}
                  </span>
                </span>
              </button>
            </form>
          ))}
        </div>
        <ListEnd />
        </>
      )}
    </div>
  );
}
