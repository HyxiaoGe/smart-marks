/**
 * 域名分类字典 - 主流网站的分类映射
 */

export interface DomainPattern {
  category: string;
  keywords: string[];
  confidence?: number;
}

export const DOMAIN_PATTERNS: Record<string, DomainPattern> = {
  // 开发工具
  'github.com': { category: '开发工具', keywords: ['代码', '仓库', 'repository', 'git'] },
  'gitlab.com': { category: '开发工具', keywords: ['代码', 'git', '仓库'] },
  'gitee.com': { category: '开发工具', keywords: ['码云', '代码', 'git'] },
  'stackoverflow.com': { category: '开发工具', keywords: ['问答', '编程', '开发'] },
  'segmentfault.com': { category: '开发工具', keywords: ['思否', '问答', '编程'] },
  'npmjs.com': { category: '开发工具', keywords: ['npm', '包管理', 'javascript'] },
  'pypi.org': { category: '开发工具', keywords: ['python', '包', 'pip'] },
  'hub.docker.com': { category: '开发工具', keywords: ['docker', '容器', '镜像'] },
  'codepen.io': { category: '开发工具', keywords: ['代码', '前端', '演示'] },
  'jsfiddle.net': { category: '开发工具', keywords: ['代码', 'javascript', '演示'] },
  'codesandbox.io': { category: '开发工具', keywords: ['代码', '沙箱', '在线编辑'] },
  'replit.com': { category: '开发工具', keywords: ['代码', '在线编程', 'IDE'] },
  
  // AI相关
  'openai.com': { category: 'AI工具', keywords: ['chatgpt', 'gpt', 'ai'] },
  'chat.openai.com': { category: 'AI工具', keywords: ['chatgpt', '聊天', 'ai'] },
  'claude.ai': { category: 'AI工具', keywords: ['claude', 'anthropic', 'ai'] },
  'perplexity.ai': { category: 'AI工具', keywords: ['搜索', 'ai', '问答'] },
  'midjourney.com': { category: 'AI工具', keywords: ['图像', '生成', 'ai绘画'] },
  'stable-diffusion-ui.com': { category: 'AI工具', keywords: ['stable diffusion', 'ai绘画'] },
  'huggingface.co': { category: 'AI工具', keywords: ['模型', 'ai', '机器学习'] },
  'kaggle.com': { category: 'AI工具', keywords: ['数据科学', '机器学习', '竞赛'] },
  'colab.research.google.com': { category: 'AI工具', keywords: ['jupyter', 'python', '机器学习'] },
  
  // 社交媒体
  'twitter.com': { category: '社交媒体', keywords: ['推特', '社交', 'tweet'] },
  'x.com': { category: '社交媒体', keywords: ['推特', 'X', '社交'] },
  'facebook.com': { category: '社交媒体', keywords: ['脸书', '社交', 'fb'] },
  'instagram.com': { category: '社交媒体', keywords: ['照片', '社交', 'ins'] },
  'linkedin.com': { category: '社交媒体', keywords: ['领英', '职业', '社交'] },
  'reddit.com': { category: '社交媒体', keywords: ['论坛', '讨论', '社区'] },
  'discord.com': { category: '社交媒体', keywords: ['聊天', '游戏', '社区'] },
  'telegram.org': { category: '社交媒体', keywords: ['电报', '聊天', '即时通讯'] },
  'weibo.com': { category: '社交媒体', keywords: ['微博', '社交', '中文'] },
  'zhihu.com': { category: '社交媒体', keywords: ['知乎', '问答', '知识'] },
  'douban.com': { category: '社交媒体', keywords: ['豆瓣', '评分', '社区'] },
  
  // 视频娱乐
  'youtube.com': { category: '视频娱乐', keywords: ['视频', '教程', 'youtube'] },
  'bilibili.com': { category: '视频娱乐', keywords: ['B站', '视频', '番剧'] },
  'netflix.com': { category: '视频娱乐', keywords: ['奈飞', '电影', '剧集'] },
  'twitch.tv': { category: '视频娱乐', keywords: ['直播', '游戏', '主播'] },
  'douyu.com': { category: '视频娱乐', keywords: ['斗鱼', '直播', '游戏'] },
  'huya.com': { category: '视频娱乐', keywords: ['虎牙', '直播', '游戏'] },
  'iqiyi.com': { category: '视频娱乐', keywords: ['爱奇艺', '视频', '电影'] },
  'youku.com': { category: '视频娱乐', keywords: ['优酷', '视频', '电影'] },
  'v.qq.com': { category: '视频娱乐', keywords: ['腾讯视频', '视频', '电影'] },
  
  // 新闻资讯
  'cnn.com': { category: '新闻资讯', keywords: ['新闻', '国际', 'CNN'] },
  'bbc.com': { category: '新闻资讯', keywords: ['新闻', 'BBC', '国际'] },
  'reuters.com': { category: '新闻资讯', keywords: ['路透社', '新闻', '国际'] },
  'bloomberg.com': { category: '新闻资讯', keywords: ['彭博', '财经', '新闻'] },
  'wsj.com': { category: '新闻资讯', keywords: ['华尔街日报', '财经', '新闻'] },
  '36kr.com': { category: '新闻资讯', keywords: ['36氪', '科技', '创业'] },
  'ithome.com': { category: '新闻资讯', keywords: ['IT之家', '科技', '数码'] },
  'sina.com.cn': { category: '新闻资讯', keywords: ['新浪', '新闻', '门户'] },
  'qq.com': { category: '新闻资讯', keywords: ['腾讯', '新闻', '门户'] },
  '163.com': { category: '新闻资讯', keywords: ['网易', '新闻', '门户'] },
  
  // 购物
  'amazon.com': { category: '购物', keywords: ['亚马逊', '电商', '购物'] },
  'amazon.cn': { category: '购物', keywords: ['亚马逊', '电商', '购物'] },
  'taobao.com': { category: '购物', keywords: ['淘宝', '购物', '电商'] },
  'tmall.com': { category: '购物', keywords: ['天猫', '购物', '品牌'] },
  'jd.com': { category: '购物', keywords: ['京东', '购物', '电商'] },
  'pinduoduo.com': { category: '购物', keywords: ['拼多多', '团购', '购物'] },
  'ebay.com': { category: '购物', keywords: ['易贝', '拍卖', '购物'] },
  'shopee.com': { category: '购物', keywords: ['虾皮', '购物', '东南亚'] },
  
  // 学习教育
  'coursera.org': { category: '学习教育', keywords: ['课程', '在线教育', 'MOOC'] },
  'udemy.com': { category: '学习教育', keywords: ['课程', '教程', '在线学习'] },
  'edx.org': { category: '学习教育', keywords: ['课程', 'MOOC', '大学'] },
  'khanacademy.org': { category: '学习教育', keywords: ['可汗学院', '教育', '免费'] },
  'udacity.com': { category: '学习教育', keywords: ['优达学城', '编程', '教育'] },
  'pluralsight.com': { category: '学习教育', keywords: ['技术培训', '编程', '教程'] },
  'leetcode.com': { category: '学习教育', keywords: ['力扣', '算法', '编程'] },
  'leetcode-cn.com': { category: '学习教育', keywords: ['力扣', '算法', '编程'] },
  'hackerrank.com': { category: '学习教育', keywords: ['编程', '算法', '面试'] },
  
  // 效率工具
  'notion.so': { category: '效率工具', keywords: ['笔记', '协作', '知识管理'] },
  'notion.site': { category: '效率工具', keywords: ['notion', '页面', '分享'] },
  'obsidian.md': { category: '效率工具', keywords: ['笔记', 'markdown', '知识库'] },
  'trello.com': { category: '效率工具', keywords: ['看板', '项目管理', '协作'] },
  'asana.com': { category: '效率工具', keywords: ['项目管理', '任务', '协作'] },
  'todoist.com': { category: '效率工具', keywords: ['待办', '任务', 'GTD'] },
  'evernote.com': { category: '效率工具', keywords: ['印象笔记', '笔记', '同步'] },
  'onenote.com': { category: '效率工具', keywords: ['OneNote', '笔记', '微软'] },
  'dropbox.com': { category: '效率工具', keywords: ['云存储', '同步', '文件'] },
  'drive.google.com': { category: '效率工具', keywords: ['谷歌云盘', '存储', '协作'] },
  
  // 设计工具
  'figma.com': { category: '设计工具', keywords: ['设计', 'UI', '协作'] },
  'sketch.com': { category: '设计工具', keywords: ['设计', 'UI', 'Mac'] },
  'canva.com': { category: '设计工具', keywords: ['设计', '模板', '图片'] },
  'dribbble.com': { category: '设计工具', keywords: ['设计', '作品', '灵感'] },
  'behance.net': { category: '设计工具', keywords: ['设计', '作品集', 'Adobe'] },
  'unsplash.com': { category: '设计工具', keywords: ['图片', '免费', '高清'] },
  'pexels.com': { category: '设计工具', keywords: ['图片', '免费', '素材'] },
  
  // 搜索引擎
  'google.com': { category: '搜索引擎', keywords: ['搜索', '谷歌', 'Google'] },
  'baidu.com': { category: '搜索引擎', keywords: ['搜索', '百度', '中文'] },
  'bing.com': { category: '搜索引擎', keywords: ['搜索', '必应', '微软'] },
  'duckduckgo.com': { category: '搜索引擎', keywords: ['搜索', '隐私', 'DuckDuckGo'] },
  
  // 技术文档
  'developer.mozilla.org': { category: '技术文档', keywords: ['MDN', '文档', 'Web'] },
  'w3schools.com': { category: '技术文档', keywords: ['教程', 'Web', 'HTML'] },
  'devdocs.io': { category: '技术文档', keywords: ['文档', 'API', '开发'] },
  'docs.microsoft.com': { category: '技术文档', keywords: ['微软', '文档', '.NET'] },
  'docs.python.org': { category: '技术文档', keywords: ['Python', '文档', '官方'] },
  'nodejs.org': { category: '技术文档', keywords: ['Node.js', 'JavaScript', '文档'] },
  'reactjs.org': { category: '技术文档', keywords: ['React', '前端', '文档'] },
  'vuejs.org': { category: '技术文档', keywords: ['Vue', '前端', '文档'] },
  
  // 游戏相关
  'steam.com': { category: '游戏平台', keywords: ['Steam', '游戏', 'PC'] },
  'epicgames.com': { category: '游戏平台', keywords: ['Epic', '游戏', '商店'] },
  'playstation.com': { category: '游戏平台', keywords: ['PS', '索尼', '游戏'] },
  'xbox.com': { category: '游戏平台', keywords: ['Xbox', '微软', '游戏'] },
  'nintendo.com': { category: '游戏平台', keywords: ['任天堂', 'Switch', '游戏'] },
};

/**
 * 根据域名获取分类信息
 */
export function getDomainPattern(url: string): DomainPattern | null {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    
    // 精确匹配
    if (DOMAIN_PATTERNS[hostname]) {
      return { ...DOMAIN_PATTERNS[hostname], confidence: 0.95 };
    }
    
    // 子域名匹配
    for (const [domain, pattern] of Object.entries(DOMAIN_PATTERNS)) {
      if (hostname.endsWith('.' + domain) || hostname === domain) {
        return { ...pattern, confidence: 0.9 };
      }
    }
    
    return null;
  } catch (error) {
    console.error('解析URL失败:', error);
    return null;
  }
}

/**
 * 获取所有预定义的分类
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>();
  Object.values(DOMAIN_PATTERNS).forEach(pattern => {
    categories.add(pattern.category);
  });
  return Array.from(categories).sort();
}