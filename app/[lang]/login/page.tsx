import { LoginForm } from "@/components/login-form";
import { BackButton } from "@/components/page-header";
import { Brand } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { getDict } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/i18n/metadata";
import { LocaleLink } from "@/lib/i18n/link";

export const generateMetadata = pageTitle((t) => t.login.metaTitle);

export default async function LoginPage({
  searchParams,
}: PageProps<"/[lang]/login">) {
  const t = await getDict();
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  // 回跳目标不带语言前缀，交给 LoginForm 提交后由 action 按当前语言补
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/";

  return (
    <>
      {/* 移动端没有顶部导航条，登录页是未登录用户唯一能手动切语言的地方
          （自动识别 Accept-Language 覆盖不到改主意的人） */}
      <div className="flex items-center justify-between p-4 md:justify-end">
        <div className="md:hidden">
          <BackButton />
        </div>
        <LanguageToggle />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="w-full max-w-[360px]">
          <Brand size="lg" className="justify-center" />
          <p className="mb-8 mt-2 text-center text-sm text-gray">
            {t.brand.slogan}
          </p>
          <div className="rounded-md border border-line bg-panel p-6">
            <h1 className="mb-4 text-xl font-semibold">{t.login.heading}</h1>
            <LoginForm next={next} />
            <p className="mt-4 text-center text-2xs leading-5 text-gray">
              {t.login.agreementPrefix}
              <LocaleLink
                href="/terms"
                className="underline underline-offset-2"
              >
                {t.login.termsLink}
              </LocaleLink>
              {t.login.agreementAnd}
              <LocaleLink
                href="/privacy"
                className="underline underline-offset-2"
              >
                {t.login.privacyLink}
              </LocaleLink>
            </p>
          </div>
          {process.env.NODE_ENV !== "production" && (
            <p className="mt-3 font-mono text-2xs text-gray">
              {t.login.devHint}
            </p>
          )}
        </div>
      </main>
    </>
  );
}
