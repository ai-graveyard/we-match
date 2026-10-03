import { buttonVariants } from "@/components/ui/button";

/* 共用样式常量。规范见 docs/DESIGN.md。
 *
 * 之前每个组件各写各的类名字面量：光「表单错误」就有 text-accent / text-ink /
 * text-ink font-semibold / text-3xs text-ink 四种写法，分段控件有四种高度。
 * 类名散在二十来个文件里，改规范时漏一个就是一处不齐——跟 globals.css 把字号
 * 收进 @theme 是同一件事，这里收的是控件。
 *
 * 只放**跨文件复用**的控件。单页独有的排版留在页面里，搬进来反而找不到。
 *
 * 约定：拼接时**不要用两个工具类去覆盖同一个 CSS 属性**（如 `${tag} border-ink`
 * 盖掉 tag 里的 border-line）。Tailwind 里谁生效取决于生成的 CSS 顺序，不是
 * 字符串里谁写在后面——`border-ink` 反而会被 `border-line` 压掉。所以有开关态的
 * 控件一律写成函数或成对常量，把整串一次性算出来。带 variant 的除外
 * （`hover:` / `md:` 等永远排在无 variant 的后面，可以安全叠加）。 */

/** 主按钮：每屏唯一的焦橙控件。高 44px（DESIGN.md「按钮」） */
export const primaryBtn = buttonVariants({ variant: "default" });

/** 次按钮：墨色描边，悬停反色。承载动作的按钮一律 44px，不分主次 */
export const secondaryBtn = buttonVariants({ variant: "outline" });

/** 墨底白字：两步确认里的那一下（退出登录、注销账号）。不用焦橙——
 *  焦橙是「这屏要你做的事」，而确认删除恰恰不该被鼓励 */
export const inkBtn = buttonVariants({ variant: "destructive" });

/** 次按钮的弱化档：灰边灰字，用于与主动作并列的「取消」 */
export const quietBtn = buttonVariants({ variant: "secondary" });

/** 44px 方形图标按钮。只有图标的动作照样是动作，一样按 44px 走 */
const iconBtnBase =
  "flex size-11 shrink-0 items-center justify-center rounded-sm border bg-panel transition-colors duration-100 active:translate-y-px active:bg-bg-3";
/** 关闭、返回这类退出动作 */
export const iconBtnLine = `${iconBtnBase} border-line text-gray`;
/** 与主动作并列的图标动作（保存图片、复制链接） */
export const iconBtnInk = `${iconBtnBase} border-ink text-ink`;
/** 返回：与关闭同形，但箭头走墨色——它通向上一页，不是退出当前操作 */
export const iconBtnBack = `${iconBtnBase} border-line text-ink`;

/** 纯文字的轻量动作（展开确认、撤回、切换），不占按钮盒子 */
export const textBtn =
  "inline-flex items-center gap-1 text-2xs text-gray transition-colors duration-100 hover:text-ink";

/** 输入框：与按钮同高，focus 转墨边（不用橙） */
export const input =
  "h-11 w-full rounded-sm border border-line bg-panel px-3 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink";

/** 多档同级选择：长标签使用下拉框，避免把分段控件挤出屏幕。 */
export const selectInput =
  "h-10 min-w-0 rounded-sm border border-line bg-panel px-3 text-xs text-ink outline-none focus:border-ink";

/** 多行输入：撤掉固定高度，其余与 input 一致 */
export const textarea =
  "w-full resize-y rounded-sm border border-line bg-panel px-3 py-2 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink";

/** 小节标签：12px / 600 / 字距 0.08em / --gray（DESIGN.md「字体分工」） */
export const sectionLabel = "text-2xs font-semibold tracking-[0.08em] text-gray";

/** 面板：卡片、表单、列表容器，12px 圆角 + 1px 描边，不用阴影 */
export const panel = "rounded-md border border-line bg-panel";

/** 状态徽章：灰底等宽极小注记（进行中 / 已完成 / 私密 / 待审批…） */
export const badge =
  "shrink-0 rounded-sm bg-bg-3 px-1.5 py-px font-mono text-3xs text-gray";

/** 展示型标签，见 DESIGN.md「标签（tag）」：选中态边框和文字转 --ink */
export function tag(selected = false) {
  return `rounded-sm border px-1.5 py-0.5 font-mono text-2xs ${
    selected ? "border-ink text-ink" : "border-line text-gray"
  }`;
}

/** 可点选 chip：期限 / 范围 / 区块导航这类换行排布的选项 */
export const chip =
  "rounded-sm border px-2.5 py-1 text-xs transition-colors duration-100";
export const chipOn = "border-ink bg-ink font-semibold text-panel";
export const chipOff = "border-line text-gray hover:border-ink hover:text-ink";

/** 外框不含布局，供等分网格复用，避免 grid 与 inline-flex 相互覆盖。 */
export const segmentFrame =
  "h-10 overflow-hidden rounded-sm border border-line";
export const segmentGroup = `inline-flex ${segmentFrame}`;

/** 分段控件的一段。40px——它是在同级选项间切换，不是承载动作的按钮 */
export function segmentItem(active: boolean, first: boolean) {
  return [
    "flex h-full min-w-0 items-center justify-center whitespace-nowrap px-3 text-center text-2xs transition-colors duration-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-ink",
    first ? "" : "border-l border-line",
    active ? "bg-ink font-semibold text-panel" : "text-gray hover:text-ink",
  ]
    .filter(Boolean)
    .join(" ");
}

/** 「我的 → 设置」里的整行：左侧标题 + 说明，右侧控件或去向 */
export const settingsRow =
  "flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left";

/** 整行可点时才加悬停底色——语言那行整行不可点（可点的是里面两个链接），
 *  给它加 hover 会让人以为点哪都行 */
export const settingsRowInteractive = `${settingsRow} transition-colors duration-100 hover:bg-bg-3 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-ink`;

/** 设置行右侧的两档迷你切换器（明暗主题、中英文）。
 *  内圆角 6px = 外框 8px 减去 2px 内边距，跟着 --radius-sm 走 */
export const miniSwitch =
  "grid shrink-0 grid-cols-2 rounded-sm border border-line bg-bg-2 p-0.5";
export const miniSwitchItem =
  "flex h-6 items-center justify-center rounded-[6px] px-2 font-mono text-3xs";

/** 表单校验错误：单行 text-accent 文案，不加边框和图标（DESIGN.md 焦橙纪律末段） */
export const fieldError = "text-xs text-accent";

/** 6px 状态灯：只标记「有一件事此刻成立」，不是装饰。
 *  Off 档是同尺寸的灰点，用于「这一条已经处理过了」的对照 */
export const statusDot = "size-1.5 shrink-0 rounded-full bg-accent";
export const statusDotOff = "size-1.5 shrink-0 rounded-full bg-line";
