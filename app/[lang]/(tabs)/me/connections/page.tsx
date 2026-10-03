import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { Card } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import {
  getInitiatedConnections,
  getReceivedConnections,
  type ConnectionCenterRow,
} from "@/lib/queries";
import { isStalePending } from "@/lib/quota";
import { ConnectionCard } from "@/components/connection-panel";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/list-states";
import { getDict, getLocale } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import { LocaleLink } from "@/lib/i18n/link";
import { localePath } from "@/lib/i18n/routing";
import { panel } from "@/lib/ui";

export const generateMetadata = pageTitle((t) => t.connection.centerTitle);

type View = "received" | "initiated";

function isView(value: unknown): value is View {
  return value === "received" || value === "initiated";
}

export default async function ConnectionsCenterPage({
  searchParams,
}: PageProps<"/[lang]/me/connections">) {
  const t = await getDict();
  const locale = await getLocale();
  const user = await getSessionUser();
  if (!user) redirect(localePath(locale, "/login?next=/me/connections"));

  const params = await searchParams;
  const viewParam = Array.isArray(params.view) ? params.view[0] : params.view;
  const view: View = isView(viewParam) ? viewParam : "received";

  const rows =
    view === "received"
      ? await getReceivedConnections(user.id)
      : await getInitiatedConnections(user.id);
  const isOwner = view === "received";

  const tabs: { id: View; label: string }[] = [
    { id: "received", label: t.connection.tabReceived },
    { id: "initiated", label: t.connection.tabInitiated },
  ];

  return (
    <div>
      <PageHeader title={t.connection.centerTitle} className="mb-4" />

      <Tabs value={view} activationMode="manual">
      <TabsList
        aria-label={t.connection.centerTitle}
        className="flex items-center gap-1"
      >
        {tabs.map((tab) => {
          const active = tab.id === view;
          return (
            <TabsTrigger key={tab.id} value={tab.id} asChild>
            <LocaleLink
              href={`/me/connections?view=${tab.id}`}
              aria-current={active ? "page" : undefined}
              scroll={false}
              className={`flex h-10 min-w-0 flex-1 items-center justify-center rounded-sm text-sm font-semibold transition-colors duration-100 ${
                active
                  ? "bg-bg-3 text-ink"
                  : "text-gray hover:text-ink"
              }`}
            >
              {tab.label}
            </LocaleLink>
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value={view} className="mt-4">
        {rows.length === 0 ? (
          <EmptyState>
            {isOwner
              ? t.connection.receivedEmpty
              : t.connection.initiatedEmpty}
          </EmptyState>
        ) : (
          <Card className={panel}>
            {rows.map((row: ConnectionCenterRow, index) => (
              <ConnectionCard
                key={row.id}
                first={index === 0}
                isOwner={isOwner}
                otherName={row.otherName}
                needHref={`/needs/${row.needId}`}
                needTitle={row.needTitle}
                row={{
                  id: row.id,
                  initiatorId: row.otherId,
                  initiatorName: row.otherName,
                  message: row.message,
                  status: row.status,
                  stale: isStalePending(row.status, row.createdAt),
                  ownerConfirmed: !!row.ownerConfirmedAt,
                  initiatorConfirmed: !!row.initiatorConfirmedAt,
                }}
              />
            ))}
          </Card>
        )}
      </TabsContent>
      </Tabs>
    </div>
  );
}
