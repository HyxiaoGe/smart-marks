/**
 * 文件夹名称标准化服务
 * 将各种变体的文件夹名称映射到标准名称
 */

// 文件夹名称标准化映射
export const FOLDER_NORMALIZATION_MAP: Record<string, string> = {
  // 开发相关
  '开发': '开发工具',
  'Dev': '开发工具',
  'Development': '开发工具',
  '编程': '开发工具',
  'Programming': '开发工具',
  '代码': '开发工具',
  'Code': '开发工具',
  'GitHub': '开发工具',
  '技术': '开发工具',
  'Tech': '开发工具',
  
  // AI相关
  'AI': 'AI工具',
  'ai': 'AI工具',
  '人工智能': 'AI工具',
  'ChatGPT': 'AI工具',
  'LLM': 'AI工具',
  '机器学习': 'AI工具',
  'ML': 'AI工具',
  
  // 学习相关
  '学习': '学习教育',
  'Study': '学习教育',
  '教育': '学习教育',
  'Education': '学习教育',
  '课程': '学习教育',
  'Course': '学习教育',
  '教程': '学习教育',
  'Tutorial': '学习教育',
  
  // 工作相关
  '工作': '工作效率',
  'Work': '工作效率',
  '办公': '工作效率',
  'Office': '工作效率',
  '效率': '工作效率',
  'Productivity': '工作效率',
  '笔记': '效率工具',
  'Notes': '效率工具',
  
  // 设计相关
  '设计': '设计工具',
  'Design': '设计工具',
  'UI': '设计工具',
  'UX': '设计工具',
  '美工': '设计工具',
  
  // 娱乐相关
  '视频': '视频娱乐',
  'Video': '视频娱乐',
  '影视': '视频娱乐',
  '电影': '视频娱乐',
  'Movie': '视频娱乐',
  'YouTube': '视频娱乐',
  'B站': '视频娱乐',
  'Bilibili': '视频娱乐',
  
  // 社交相关
  '社交': '社交媒体',
  'Social': '社交媒体',
  'SNS': '社交媒体',
  '社区': '社交媒体',
  'Community': '社交媒体',
  'Twitter': '社交媒体',
  
  // 新闻相关
  '新闻': '新闻资讯',
  'News': '新闻资讯',
  '资讯': '新闻资讯',
  '媒体': '新闻资讯',
  'Media': '新闻资讯',
  
  // 购物相关
  '购物': '购物',
  'Shopping': '购物',
  '电商': '购物',
  'Ecommerce': '购物',
  '买东西': '购物',
  
  // 游戏相关
  '游戏': '游戏平台',
  'Game': '游戏平台',
  'Gaming': '游戏平台',
  'Steam': '游戏平台',
  
  // 其他常见映射
  '工具': '在线工具',
  'Tools': '在线工具',
  '网站': '常用网站',
  'Websites': '常用网站',
  '收藏': '我的收藏',
  'Favorites': '我的收藏',
  '临时': '待整理',
  'Temp': '待整理',
  '未分类': '待整理',
  'Uncategorized': '待整理',
};

// 推荐的标准文件夹列表
export const STANDARD_FOLDERS = [
  '开发工具',
  'AI工具',
  '学习教育',
  '工作效率',
  '效率工具',
  '设计工具',
  '视频娱乐',
  '社交媒体',
  '新闻资讯',
  '购物',
  '游戏平台',
  '技术文档',
  '在线工具',
  '搜索引擎',
  '金融理财',
  '健康医疗',
  '旅游出行',
  '生活服务',
  '常用网站',
  '我的收藏',
  '待整理'
];

/**
 * 标准化文件夹名称
 */
export function normalizeFolder(folderName: string): string {
  // 1. 直接映射查找
  if (FOLDER_NORMALIZATION_MAP[folderName]) {
    return FOLDER_NORMALIZATION_MAP[folderName];
  }
  
  // 2. 忽略大小写查找
  const lowerName = folderName.toLowerCase();
  for (const [key, value] of Object.entries(FOLDER_NORMALIZATION_MAP)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  
  // 3. 部分匹配查找
  for (const [key, value] of Object.entries(FOLDER_NORMALIZATION_MAP)) {
    if (folderName.includes(key) || key.includes(folderName)) {
      return value;
    }
  }
  
  // 4. 如果没有找到映射，返回原名称
  return folderName;
}

/**
 * 检查是否需要标准化
 */
export function needsNormalization(folderName: string): boolean {
  const normalized = normalizeFolder(folderName);
  return normalized !== folderName;
}

/**
 * 获取文件夹的所有可能变体
 */
export function getFolderVariants(standardName: string): string[] {
  const variants = [standardName];
  
  for (const [variant, standard] of Object.entries(FOLDER_NORMALIZATION_MAP)) {
    if (standard === standardName && !variants.includes(variant)) {
      variants.push(variant);
    }
  }
  
  return variants;
}

/**
 * 查找相似的标准文件夹
 */
export function findSimilarStandardFolder(folderName: string): string | null {
  const normalized = normalizeFolder(folderName);
  
  // 如果标准化后的名称在标准列表中，返回它
  if (STANDARD_FOLDERS.includes(normalized)) {
    return normalized;
  }
  
  // 尝试模糊匹配
  const lowerName = folderName.toLowerCase();
  for (const standard of STANDARD_FOLDERS) {
    if (standard.toLowerCase().includes(lowerName) || 
        lowerName.includes(standard.toLowerCase())) {
      return standard;
    }
  }
  
  return null;
}

/**
 * 合并文件夹建议
 * 返回应该合并到哪个标准文件夹
 */
export function getMergeSuggestion(existingFolders: string[]): Map<string, string> {
  const suggestions = new Map<string, string>();
  
  for (const folder of existingFolders) {
    if (needsNormalization(folder)) {
      const standard = normalizeFolder(folder);
      if (standard !== folder) {
        suggestions.set(folder, standard);
      }
    }
  }
  
  return suggestions;
}