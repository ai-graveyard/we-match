import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { BRAND_NAME, OPERATOR_CONTACT, OPERATOR_NAME } from "@/lib/brand";

export const metadata = { title: "隐私政策" };

const UPDATED_AT = "2026-08-07";

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

export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="隐私政策" className="mb-6" />
      <article className="space-y-6 text-sm leading-6">
        <p className="text-gray">
          更新日期：{UPDATED_AT}。本政策说明 {BRAND_NAME} 的运营者
          {OPERATOR_NAME}（下称「我们」）如何收集、使用和保护你的个人信息，与
          <Link href="/terms" className="underline underline-offset-2">
            《用户协议》
          </Link>
          共同构成你使用本服务的基础约定。
        </p>

        <Section title="1. 我们收集哪些信息">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>手机号</strong>：注册登录的必需信息，用于身份验证。
            </li>
            <li>
              <strong>名片资料</strong>
              ：你自愿填写的昵称、简介、标签、联系方式与社媒账号等。
            </li>
            <li>
              <strong>你发布的内容</strong>：需求（我需要 /
              我提供）、组织信息等。
            </li>
            <li>
              <strong>日志信息</strong>：登录与关键操作的 IP
              地址和时间，用于安全风控与频率限制。
            </li>
          </ul>
        </Section>

        <Section title="2. 我们如何使用这些信息">
          <p>
            仅用于：登录鉴权与会话保持；按你设置的可见范围向其他用户展示名片与需求；防滥用的安全风控。我们不做画像营销，不向你推送商业广告。
          </p>
        </Section>

        <Section title="3. 可见范围由你控制">
          <p>
            名片上的联系方式与社媒字段支持逐项设置「登录可见 / 共同组织可见 /
            隐藏」。请注意：设为「登录可见」意味着任何注册用户都能看到该字段；未登录访客与搜索引擎始终无法获取联系方式原文。
          </p>
        </Section>

        <Section title="4. 对外提供">
          <p>
            我们不出售你的个人信息。仅在以下情形对外提供：向短信服务商提供手机号以发送验证码（发送即用，不用于其他目的）；法律法规或有权机关依法要求。
          </p>
        </Section>

        <Section title="5. Cookie 与存储">
          <p>
            我们只使用一个用于保持登录状态的必要
            Cookie（httpOnly，签名防篡改，30 天有效），不使用任何第三方统计或广告
            Cookie。你的数据存储在中华人民共和国境内的服务器上，传输过程使用
            HTTPS 加密。
          </p>
        </Section>

        <Section title="6. 你的权利">
          <p>
            你可以随时在「我的 →
            名片」查看、更正或清空自己的资料，自行关闭或删除需求，吊销 API
            Key。你也可以在「我的 → 设置 →
            注销账号」自助永久注销：注销后名片资料即被清除、需求全部关闭、API
            Key 全部失效；手机号会保留在系统内，仅用于确保该号码无法再次登录（注销不可恢复），法律要求留存的信息亦会依法保留。行使其他法定权利可通过下方联系方式联系我们。
          </p>
        </Section>

        <Section title="7. 未成年人保护">
          <p>
            本服务面向具备相应民事行为能力的用户。若我们发现在未获监护人同意的情况下收集了未成年人的个人信息，会尽快删除。
          </p>
        </Section>

        <Section title="8. 政策更新">
          <p>
            本政策可能随功能变化而修订，修订后会在本页更新并标注日期；重大变更会以站内显著方式提示。
          </p>
        </Section>

        <Section title="9. 联系我们">
          <p>
            运营者：{OPERATOR_NAME}；联系方式：{OPERATOR_CONTACT}。
          </p>
        </Section>
      </article>
    </>
  );
}
