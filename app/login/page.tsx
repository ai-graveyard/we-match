import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { BackButton } from "@/components/page-header";
import { Brand } from "@/components/brand";
import { BRAND_SLOGAN } from "@/lib/brand";

export const metadata = { title: "登录" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/";

  return (
    <>
      <div className="p-4 md:hidden">
        <BackButton />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="w-full max-w-[360px]">
          <Brand size="lg" className="justify-center" />
          <p className="mb-8 mt-2 text-center text-sm text-gray">
            {BRAND_SLOGAN}
          </p>
          <div className="rounded-md border border-line bg-panel p-6">
            <h1 className="mb-4 text-xl font-semibold">
              手机号登录
            </h1>
            <LoginForm next={next} />
            <p className="mt-4 text-center text-2xs leading-5 text-gray">
              登录即代表你已阅读并同意
              <Link href="/terms" className="underline underline-offset-2">
                《用户协议》
              </Link>
              与
              <Link href="/privacy" className="underline underline-offset-2">
                《隐私政策》
              </Link>
            </p>
          </div>
          {process.env.NODE_ENV !== "production" && (
            <p className="mt-3 font-mono text-2xs text-gray">
              dev：验证码固定 888888
            </p>
          )}
        </div>
      </main>
    </>
  );
}
