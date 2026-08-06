import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { BRAND_NAME, OPERATOR_CONTACT, OPERATOR_NAME } from "@/lib/brand";

export const metadata = { title: "用户协议" };

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

export default function TermsPage() {
  return (
    <>
      <PageHeader title="用户协议" className="mb-6" />
      <article className="space-y-6 text-sm leading-6">
        <p className="text-gray">
          更新日期：{UPDATED_AT}。本协议由你与 {BRAND_NAME} 的运营者
          {OPERATOR_NAME}（下称「我们」）订立。注册或使用本服务即表示你已阅读并同意本协议与
          <Link href="/privacy" className="underline underline-offset-2">
            《隐私政策》
          </Link>
          。
        </p>

        <Section title="1. 服务说明">
          <p>
            {BRAND_NAME} 是一个供需信息展示工具：你可以维护一张名片，发布「我需要 /
            我提供」到公开广场或所在组织，并通过他人开放的联系渠道自行联系对方。我们只做信息展示与检索，
            <strong>不参与、不担保、不介入</strong>
            任何用户之间的沟通、合作或交易。
          </p>
        </Section>

        <Section title="2. 账号">
          <p>
            本服务使用手机号加短信验证码注册登录。你应确保手机号为本人持有，并妥善保管登录设备与验证码；通过你的账号进行的操作视为你本人的行为。你应具备与使用行为相适应的民事行为能力；未成年人应在监护人同意与指导下使用。
          </p>
        </Section>

        <Section title="3. 内容与行为规范">
          <p>
            你对自己发布的名片、需求、组织信息及其他内容负责，并保证其真实、合法、不侵犯他人权利。禁止发布法律法规禁止的内容，禁止骚扰、欺诈、冒充他人、批量发布广告或垃圾信息，禁止未经授权抓取、爬取或转售平台数据。
          </p>
          <p>
            为了向其他用户展示，你授予我们在本服务范围内存储、展示你所发布内容的许可；你删除内容或注销账号后该许可终止。
          </p>
        </Section>

        <Section title="4. 平台治理">
          <p>
            任何用户都可以举报违规内容或用户。我们有权根据本协议与法律法规对违规内容做下架处理，对违规账号做暂停或终止服务处理。
          </p>
        </Section>

        <Section title="5. 线下联系与风险提示">
          <p>
            平台上的联系方式、身份与能力信息均由用户自行填写，我们不对其真实性、准确性作任何担保。你在线下与他人联系、合作或交易前，请自行核实对方身份与信息；由此产生的纠纷与损失由相关用户自行承担。
          </p>
        </Section>

        <Section title="6. 开放 API 与 Agent 接入">
          <p>
            你可以生成 API Key 授权程序以你的身份读写数据。API Key
            等同于你的登录凭证，请妥善保管、泄露后及时吊销；通过 API
            的操作同样受本协议约束。我们可能对接口调用施加频率限制。
          </p>
        </Section>

        <Section title="7. 免责与责任限制">
          <p>
            本服务按「现状」提供。在法律允许的范围内，我们不对服务不中断、无错误作出保证，亦不对因使用本服务产生的间接损失承担责任。
          </p>
        </Section>

        <Section title="8. 协议变更与终止">
          <p>
            我们可能修订本协议，修订后会在本页更新并标注日期；重大变更会以站内显著方式提示。你可以随时停止使用本服务，或在「我的 →
            设置 →
            注销账号」自助注销；注销不可恢复，注销后该手机号无法再次登录。
          </p>
        </Section>

        <Section title="9. 法律适用">
          <p>
            本协议适用中华人民共和国法律。因本协议产生的争议，双方应友好协商；协商不成的，提交我们所在地有管辖权的人民法院裁决。
          </p>
        </Section>

        <Section title="10. 联系我们">
          <p>
            运营者：{OPERATOR_NAME}；联系方式：{OPERATOR_CONTACT}。
          </p>
        </Section>
      </article>
    </>
  );
}
