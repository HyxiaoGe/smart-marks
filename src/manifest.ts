import type { PlasmoManifest } from "plasmo"

const manifest: PlasmoManifest = {
  manifest_version: 3,
  name: "Smart Marks - 智能书签管理器",
  version: "0.1.0",
  description: "智能书签管理Chrome扩展，使用AI自动将书签分类整理到合适的文件夹中",
  
  // 图标配置
  icons: {
    "16": "assets/icon16.png",
    "32": "assets/icon32.png",
    "48": "assets/icon48.png",
    "128": "assets/icon128.png"
  },
  
  // 弹出窗口配置
  action: {
    default_popup: "popup.html",
    default_title: "Smart Marks - 智能书签管理器",
    default_icon: {
      "16": "assets/icon16.png",
      "32": "assets/icon32.png"
    }
  },
  
  // 后台脚本配置
  background: {
    service_worker: "background.js"
  },
  
  // 选项页面配置
  options_page: "options.html",
  
  // 权限配置
  permissions: [
    "bookmarks",        // 书签管理权限
    "storage",          // 存储权限
    "activeTab",        // 活动标签页权限
    "scripting"         // 脚本注入权限（用于获取页面内容）
  ],
  
  // 可选权限（用户可以选择性授权）
  optional_permissions: [
    "tabs",             // 标签页权限
    "history"           // 历史记录权限（用于更好的分类）
  ],
  
  // 主机权限（用于访问网页内容进行分析）
  host_permissions: [
    "https://*/*",      // 所有HTTPS网站
    "http://localhost/*", // 本地开发服务器
    "https://api.openai.com/*", // OpenAI API
    "https://generativelanguage.googleapis.com/*" // Google Gemini API
  ],
  
  // 内容安全策略
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  },
  
  // 网络请求权限（用于调用AI API）
  externally_connectable: {
    matches: [
      "https://api.openai.com/*",
      "https://generativelanguage.googleapis.com/*"
    ]
  },
  
  // 默认语言设置
  default_locale: "zh_CN",
  
  // 最小Chrome版本要求
  minimum_chrome_version: "114"
}

export default manifest