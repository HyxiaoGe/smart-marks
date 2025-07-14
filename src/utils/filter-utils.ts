/**
 * 书签过滤工具函数
 */

interface FilterSettings {
  excludeFolders: string[];
  excludePatterns: string[];
  autoFilter: boolean;
  ignoreCase: boolean;
}

/**
 * 获取书签的完整路径
 * @param bookmarkId 书签ID
 * @returns 书签所在的文件夹路径
 */
export async function getBookmarkPath(bookmarkId: string): Promise<string> {
  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    return findBookmarkPath(bookmarkTree, bookmarkId) || '';
  } catch (error) {
    console.error('获取书签路径失败:', error);
    return '';
  }
}

/**
 * 递归查找书签路径
 * @param nodes 书签树节点
 * @param targetId 目标书签ID
 * @param currentPath 当前路径
 * @returns 书签路径
 */
function findBookmarkPath(
  nodes: chrome.bookmarks.BookmarkTreeNode[], 
  targetId: string, 
  currentPath: string = ''
): string | null {
  for (const node of nodes) {
    const newPath = currentPath ? `${currentPath}/${node.title}` : node.title;
    
    if (node.id === targetId) {
      return currentPath; // 返回父级路径
    }
    
    if (node.children) {
      const result = findBookmarkPath(node.children, targetId, newPath);
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
}

/**
 * 获取书签的父文件夹路径
 * @param bookmark 书签对象
 * @returns 父文件夹路径
 */
export async function getBookmarkFolderPath(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<string> {
  if (!bookmark.parentId) {
    return '';
  }
  
  try {
    const parents = [];
    let currentId = bookmark.parentId;
    
    while (currentId) {
      const parentNodes = await chrome.bookmarks.get(currentId);
      if (parentNodes.length > 0) {
        const parent = parentNodes[0];
        // 跳过根节点
        if (parent.parentId) {
          parents.unshift(parent.title);
        }
        currentId = parent.parentId;
      } else {
        break;
      }
    }
    
    return parents.join('/');
  } catch (error) {
    console.error('获取书签文件夹路径失败:', error);
    return '';
  }
}

/**
 * 检查路径是否匹配模式（支持通配符）
 * @param path 路径
 * @param pattern 模式（支持*通配符）
 * @returns 是否匹配
 */
export function matchPattern(path: string, pattern: string, ignoreCase: boolean = true): boolean {
  // 如果模式不包含通配符，进行精确匹配
  if (!pattern.includes('*') && !pattern.includes('?')) {
    // 精确匹配：完整路径匹配或文件夹名称匹配
    if (ignoreCase) {
      const lowerPath = path.toLowerCase();
      const lowerPattern = pattern.toLowerCase();
      return lowerPath === lowerPattern || 
             lowerPath.endsWith('/' + lowerPattern) ||
             lowerPath.split('/').includes(lowerPattern);
    } else {
      return path === pattern || 
             path.endsWith('/' + pattern) ||
             path.split('/').includes(pattern);
    }
  }
  
  // 处理 "folder/*" 模式（匹配folder下的所有子文件夹）
  if (pattern.endsWith('/*')) {
    const parentFolder = pattern.slice(0, -2); // 移除 /*
    if (ignoreCase) {
      const lowerPath = path.toLowerCase();
      const lowerParent = parentFolder.toLowerCase();
      return lowerPath.startsWith(lowerParent + '/') || 
             lowerPath.includes('/' + lowerParent + '/');
    } else {
      return path.startsWith(parentFolder + '/') || 
             path.includes('/' + parentFolder + '/');
    }
  }
  
  // 将通配符模式转换为正则表达式
  let regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  
  // 如果模式以 * 开头或结尾，允许部分匹配
  if (pattern.startsWith('*') || pattern.endsWith('*')) {
    const regex = new RegExp(regexPattern, ignoreCase ? 'i' : '');
    return regex.test(path);
  } else {
    // 否则进行完整路径匹配
    const regex = new RegExp(`^${regexPattern}$`, ignoreCase ? 'i' : '');
    return regex.test(path);
  }
}

/**
 * 检查书签是否应该被过滤（不处理）
 * @param bookmark 书签对象
 * @param filterSettings 过滤设置
 * @returns 是否应该过滤
 */
export async function shouldFilterBookmark(
  bookmark: chrome.bookmarks.BookmarkTreeNode,
  filterSettings: FilterSettings
): Promise<boolean> {
  // 如果未启用过滤，不过滤任何书签
  if (!filterSettings.autoFilter) {
    return false;
  }
  
  // 获取书签所在的文件夹路径
  const folderPath = await getBookmarkFolderPath(bookmark);
  
  // 检查是否在排除的文件夹中
  for (const excludeFolder of filterSettings.excludeFolders) {
    if (folderPath.includes(excludeFolder)) {
      console.log(`书签 "${bookmark.title}" 在排除文件夹 "${excludeFolder}" 中，跳过处理`);
      return true;
    }
  }
  
  // 检查是否匹配排除模式
  for (const pattern of filterSettings.excludePatterns) {
    if (matchPattern(folderPath, pattern, filterSettings.ignoreCase)) {
      console.log(`书签 "${bookmark.title}" 匹配排除模式 "${pattern}"，跳过处理`);
      return true;
    }
  }
  
  return false;
}

/**
 * 过滤书签列表
 * @param bookmarks 书签列表
 * @param filterSettings 过滤设置
 * @returns 过滤后的书签列表
 */
export async function filterBookmarks(
  bookmarks: chrome.bookmarks.BookmarkTreeNode[],
  filterSettings: FilterSettings
): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  const filteredBookmarks: chrome.bookmarks.BookmarkTreeNode[] = [];
  
  for (const bookmark of bookmarks) {
    const shouldFilter = await shouldFilterBookmark(bookmark, filterSettings);
    if (!shouldFilter) {
      filteredBookmarks.push(bookmark);
    }
  }
  
  return filteredBookmarks;
}

/**
 * 获取默认的过滤设置
 * @returns 默认过滤设置
 */
export function getDefaultFilterSettings(): FilterSettings {
  return {
    excludeFolders: [], // 不再设置默认排除文件夹
    excludePatterns: [], // 不再设置默认排除模式
    autoFilter: true,
    ignoreCase: true // 默认忽略大小写
  };
}

/**
 * 加载过滤设置
 * @returns 过滤设置
 */
export async function loadFilterSettings(): Promise<FilterSettings> {
  try {
    const result = await chrome.storage.sync.get(['filterSettings']);
    return result.filterSettings || getDefaultFilterSettings();
  } catch (error) {
    console.error('加载过滤设置失败:', error);
    return getDefaultFilterSettings();
  }
}

/**
 * 保存过滤设置
 * @param settings 过滤设置
 */
export async function saveFilterSettings(settings: FilterSettings): Promise<void> {
  try {
    await chrome.storage.sync.set({ filterSettings: settings });
    console.log('过滤设置已保存');
  } catch (error) {
    console.error('保存过滤设置失败:', error);
    throw error;
  }
}