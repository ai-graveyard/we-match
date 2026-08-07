import type { zh } from "@/lib/i18n/dict/zh";
import type { zhServer } from "@/lib/i18n/dict/zh.server";
import type { zhAdmin } from "@/lib/i18n/dict/zh.admin";
import type { zhLegal } from "@/lib/i18n/dict/zh.legal";

// 中文字典就是类型基准：其他语言的同名文件按这些类型声明，
// 少一个键、拼错一个键都是编译错误，不会等到线上才发现漏译。

/** 前台界面，随 I18nProvider 下发到客户端组件 */
export type UiDict = typeof zh;

/** Server Action / Route Handler / 短信的文案，只在服务端用 */
export type ServerDict = typeof zhServer;

/** 管理后台，只在 /admin 下发 */
export type AdminDict = typeof zhAdmin;

/** 用户协议与隐私政策正文，纯服务端渲染 */
export type LegalDict = typeof zhLegal;
