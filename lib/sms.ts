// 短信通道可插拔：开发/演示走日志，生产接入阿里云/腾讯云时新增实现即可
export interface SmsProvider {
  sendVerificationCode(phone: string, code: string): Promise<void>;
}

class LogSmsProvider implements SmsProvider {
  async sendVerificationCode(phone: string, code: string) {
    console.log(`[SMS] 验证码 ${code} → ${phone}（5 分钟内有效）`);
  }
}

export const smsProvider: SmsProvider = new LogSmsProvider();
