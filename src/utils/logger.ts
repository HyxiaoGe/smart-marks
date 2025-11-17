/**
 * 安全的日志工具
 * - 生产环境自动清理敏感信息
 * - 支持不同日志级别
 * - 防止API密钥等敏感数据泄露
 */

// 判断是否为开发环境
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * 敏感字段列表
 */
const SENSITIVE_KEYS = [
  'apiKey', 'api_key', 'token', 'secret',
  'openaiKey', 'geminiKey', 'deepseekKey', 'linkPreviewKey',
  'password', 'pwd', 'authorization', 'apikey'
];

/**
 * 检测字符串是否像API密钥
 */
function looksLikeApiKey(value: string): boolean {
  if (typeof value !== 'string') return false;

  // OpenAI格式: sk-...
  if (value.match(/^sk-[a-zA-Z0-9]{32,}$/)) return true;

  // Google API格式: AI...
  if (value.match(/^AI[a-zA-Z0-9]{35,}$/)) return true;

  // 其他常见API密钥格式
  if (value.length > 20 && value.match(/^[a-zA-Z0-9_-]{20,}$/)) return true;

  return false;
}

/**
 * 清理敏感信息
 */
function sanitize(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  // 基本类型
  if (typeof data === 'string') {
    return looksLikeApiKey(data) ? '***REDACTED***' : data;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  // 数组
  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  // 对象
  if (typeof data === 'object') {
    const sanitized: any = {};

    for (const key of Object.keys(data)) {
      const lowerKey = key.toLowerCase();

      // 检查键名是否包含敏感词
      if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk.toLowerCase()))) {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = sanitize(data[key]);
      }
    }

    return sanitized;
  }

  return data;
}

/**
 * 安全的日志记录器
 */
export const logger = {
  /**
   * 调试信息（仅开发环境）
   */
  debug(...args: any[]) {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args.map(sanitize));
    }
  },

  /**
   * 普通信息
   */
  info(...args: any[]) {
    console.log('[INFO]', ...args.map(sanitize));
  },

  /**
   * 警告信息
   */
  warn(...args: any[]) {
    console.warn('[WARN]', ...args.map(sanitize));
  },

  /**
   * 错误信息
   */
  error(...args: any[]) {
    console.error('[ERROR]', ...args.map(sanitize));
  },

  /**
   * 详细信息（仅开发环境）
   */
  verbose(...args: any[]) {
    if (isDevelopment) {
      console.log('[VERBOSE]', ...args.map(sanitize));
    }
  }
};

/**
 * 手动清理数据（用于特殊场景）
 */
export function sanitizeData(data: any): any {
  return sanitize(data);
}
