import { PageHeader } from "@/components/page-header";
import { BRAND_NAME, OPERATOR_CONTACT, OPERATOR_NAME } from "@/lib/brand";
import { getLegalDict } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import { LocaleLink } from "@/lib/i18n/link";
import { fmt } from "@/lib/i18n/fmt";

export const generateMetadata = pageTitle((t) => t.me.privacy);

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function PrivacyPage() {
  const legal = await getLegalDict();
  const t = legal.privacy;
  const vars = {
    date: legal.updatedAt,
    brand: BRAND_NAME,
    operator: OPERATOR_NAME,
    contact: OPERATOR_CONTACT,
  };

  return (
    <>
      <PageHeader title={t.heading} className="mb-6" />
      <article className="space-y-6 text-sm leading-6">
        <p className="text-gray">
          {fmt(t.introPrefix, vars)}
          <LocaleLink href="/terms" className="underline underline-offset-2">
            {t.introLink}
          </LocaleLink>
          {t.introSuffix}
        </p>

        <Section title={t.s1Title}>
          <ul className="list-disc space-y-1 pl-5">
            {t.s1Items.map((item) => (
              <li key={item.term}>
                <strong>{item.term}</strong>
                {item.desc}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t.s2Title}>
          <p>{t.s2a}</p>
        </Section>

        <Section title={t.s3Title}>
          <p>{t.s3a}</p>
        </Section>

        <Section title={t.s4Title}>
          <p>{t.s4a}</p>
        </Section>

        <Section title={t.s5Title}>
          <p>{t.s5a}</p>
        </Section>

        <Section title={t.s6Title}>
          <p>{t.s6a}</p>
        </Section>

        <Section title={t.s7Title}>
          <p>{t.s7a}</p>
        </Section>

        <Section title={t.s8Title}>
          <p>{t.s8a}</p>
        </Section>

        <Section title={t.s9Title}>
          <p>{fmt(t.s9a, vars)}</p>
        </Section>
      </article>
    </>
  );
}
