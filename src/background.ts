/**
 * 后台脚本 - 处理书签事件和AI分类逻辑
 */

import { shouldFilterBookmark, loadFilterSettings } from './utils/filter-utils';

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('智能书签管理器已安装');
  
  // 初始化默认设置
  chrome.storage.sync.set({
    autoClassify: true,
    aiModel: 'gpt-4o-mini',
    language: 'zh-CN'
  });
});

// 监听新书签创建事件
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log('新书签创建:', bookmark);
  
  // 检查是否启用自动分类
  const settings = await chrome.storage.sync.get(['autoClassify']);
  if (settings.autoClassify) {
    // 检查是否应该过滤这个书签
    const filterSettings = await loadFilterSettings();
    const shouldFilter = await shouldFilterBookmark(bookmark, filterSettings);
    
    if (!shouldFilter) {
      // 如果不需要过滤，则进行AI分类
      await classifyBookmark(bookmark);
    } else {
      console.log(`书签 "${bookmark.title}" 被过滤，不进行AI处理`);
    }
  }
});

// 监听书签变更事件
chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  console.log('书签更新:', id, changeInfo);
  
  // 如果标题或URL发生变化，可能需要重新分类
  if (changeInfo.title || changeInfo.url) {
    const bookmark = await chrome.bookmarks.get(id);
    if (bookmark.length > 0) {
      await classifyBookmark(bookmark[0]);
    }
  }
});

/**
 * 使用AI对书签进行智能分类
 * @param bookmark 书签对象
 */
async function classifyBookmark(bookmark: chrome.bookmarks.BookmarkTreeNode) {
  try {
    // TODO: 实现AI分类逻辑
    console.log('开始分类书签:', bookmark.title);
    
    // 这里将来会调用外部AI服务
    // 1. 分析书签的标题和URL
    // 2. 调用LLM API获取分类建议
    // 3. 创建或移动到合适的文件夹
    
    // 暂时的模拟分类逻辑
    const category = await simulateAIClassification(bookmark);
    if (category) {
      await moveBookmarkToCategory(bookmark, category);
    }
    
  } catch (error) {
    console.error('书签分类失败:', error);
  }
}

/**
 * 模拟AI分类（临时实现）
 * @param bookmark 书签对象
 * @returns 分类结果
 */
async function simulateAIClassification(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<string | null> {
  const title = bookmark.title?.toLowerCase() || '';
  const url = bookmark.url?.toLowerCase() || '';
  
  // 简单的关键词匹配分类
  if (title.includes('github') || url.includes('github.com')) {
    return '开发工具';
  }
  if (title.includes('news') || url.includes('news') || url.includes('新闻')) {
    return '新闻资讯';
  }
  if (title.includes('video') || url.includes('youtube') || url.includes('bilibili')) {
    return '视频娱乐';
  }
  if (title.includes('shop') || url.includes('taobao') || url.includes('amazon')) {
    return '购物';
  }
  if (title.includes('learn') || url.includes('course') || title.includes('教程')) {
    return '学习资料';
  }
  
  return null; // 无法分类
}

/**
 * 将书签移动到指定分类文件夹
 * @param bookmark 书签对象
 * @param category 分类名称
 */
async function moveBookmarkToCategory(bookmark: chrome.bookmarks.BookmarkTreeNode, category: string) {
  try {
    // 查找或创建分类文件夹
    const categoryFolder = await findOrCreateFolder(category);
    
    // 移动书签到分类文件夹
    if (categoryFolder && bookmark.id) {
      await chrome.bookmarks.move(bookmark.id, {
        parentId: categoryFolder.id
      });
      console.log(`书签 "${bookmark.title}" 已移动到 "${category}" 文件夹`);
    }
  } catch (error) {
    console.error('移动书签失败:', error);
  }
}

/**
 * 查找或创建文件夹
 * @param folderName 文件夹名称
 * @returns 文件夹对象
 */
async function findOrCreateFolder(folderName: string): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  try {
    // 获取书签栏
    const bookmarkBar = await chrome.bookmarks.getTree();
    const bookmarkBarNode = bookmarkBar[0].children?.find(node => node.title === '书签栏');
    
    if (!bookmarkBarNode) {
      console.error('找不到书签栏');
      return null;
    }
    
    // 在书签栏中查找智能分类文件夹
    let smartFolder = bookmarkBarNode.children?.find(node => node.title === '智能分类');
    if (!smartFolder) {
      // 创建智能分类文件夹
      smartFolder = await chrome.bookmarks.create({
        parentId: bookmarkBarNode.id,
        title: '智能分类'
      });
    }
    
    // 在智能分类文件夹中查找指定分类
    let categoryFolder = smartFolder.children?.find(node => node.title === folderName);
    if (!categoryFolder) {
      // 创建分类文件夹
      categoryFolder = await chrome.bookmarks.create({
        parentId: smartFolder.id,
        title: folderName
      });
    }
    
    return categoryFolder;
  } catch (error) {
    console.error('创建文件夹失败:', error);
    return null;
  }
}

/**
 * 批量整理现有书签
 * 由popup界面调用
 */
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'batchOrganize') {
    try {
      console.log('开始批量整理书签...');
      
      // 获取所有书签
      const bookmarks = await chrome.bookmarks.getTree();
      const allBookmarks = flattenBookmarks(bookmarks);
      
      // 过滤出需要整理的书签（排除已在智能分类文件夹中的）
      const bookmarksToOrganize = allBookmarks.filter(bookmark => 
        bookmark.url && !isInSmartFolder(bookmark)
      );
      
      // 批量分类
      for (const bookmark of bookmarksToOrganize) {
        await classifyBookmark(bookmark);
        // 添加延迟避免过快调用
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      sendResponse({ success: true, processed: bookmarksToOrganize.length });
    } catch (error) {
      console.error('批量整理失败:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
});

/**
 * 扁平化书签树
 * @param bookmarks 书签树
 * @returns 扁平化的书签数组
 */
function flattenBookmarks(bookmarks: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] {
  const result: chrome.bookmarks.BookmarkTreeNode[] = [];
  
  function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
    for (const node of nodes) {
      if (node.url) {
        result.push(node);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }
  
  traverse(bookmarks);
  return result;
}

/**
 * 检查书签是否已在智能分类文件夹中
 * @param bookmark 书签对象
 * @returns 是否在智能分类文件夹中
 */
function isInSmartFolder(bookmark: chrome.bookmarks.BookmarkTreeNode): boolean {
  // TODO: 实现检查逻辑
  // 这里需要遍历父节点路径，检查是否在"智能分类"文件夹下
  return false;
}