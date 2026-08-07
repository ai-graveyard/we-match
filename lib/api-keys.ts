// API Key 的共享常量与纯函数。不带 server-only，客户端组件也能引；
// 真正读写数据库的部分在 lib/api-keys-service.ts。

export const API_KEY_LIMITS = {
  perUser: 3, // 每用户 Key 上限，删除即释放名额
  name: 20,
} as const;

export type ApiKeyListItem = {
  id: number;
  name: string;
  lastFour: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

/** 末四位打码；早期没记 lastFour 的返回 null，由调用方给一句兜底文案 */
export function maskApiKey(lastFour: string | null): string | null {
  return lastFour ? `wm_……${lastFour}` : null;
}
