/**
 * 后台脚本 - 处理书签事件和AI分类逻辑
 */

import { shouldFilterBookmark, loadFilterSettings } from './utils/filter-utils';
import { classifyBookmark as aiClassifyBookmark } from './services/ai-service';
import { showNotification, showProgressNotification, clearProgressNotification } from './utils/notification';
import { organizeHistory } from './services/organize-history';
import { classificationCache } from './services/classification-cache';
import { logger } from '~/utils/logger';

// 存储页面元数据的临时缓存
const pageMetadataCache = new Map<string, any>();

// 存储已处理的书签ID，避免重复处理
const processedBookmarks = new Set<string>();

// 加载已处理的书签记录
async function loadProcessedBookmarks() {
  try {
    const result = await chrome.storage.local.get('processedBookmarks');
    if (result.processedBookmarks) {
      result.processedBookmarks.forEach((id: string) => processedBookmarks.add(id));
    }
  } catch (error) {
    logger.error('加载已处理书签记录失败:', error);
  }
}

// 保存已处理的书签记录
async function saveProcessedBookmarks() {
  try {
    await chrome.storage.local.set({
      processedBookmarks: Array.from(processedBookmarks)
    });
  } catch (error) {
    logger.error('保存已处理书签记录失败:', error);
  }
}

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  // logger.debug('智能书签管理器已安装');
  
  // 初始化默认设置
  chrome.storage.sync.set({
    autoClassify: true,
    aiModel: 'gpt-4o-mini',
    language: 'zh-CN'
  });
  
  // 加载已处理的书签记录
  loadProcessedBookmarks();
});

// 扩展启动时也加载记录
loadProcessedBookmarks();

// Service Worker 激活时的日志
// logger.debug('智能书签管理器 Service Worker 已启动', new Date().toLocaleTimeString());

// 用于跟踪最近创建的书签，避免重复处理
const recentlyCreatedBookmarks = new Set<string>();

// 用于跟踪正在移动的书签，避免竞态条件
const movingBookmarks = new Set<string>();

// 记录书签的预期位置，用于检测外部干扰
const expectedLocations = new Map<string, string>();

// 监听新书签创建事件
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  // logger.debug('新书签创建:', bookmark.title);
  
  // 检查是否启用自动分类和API配置
  const settings = await chrome.storage.sync.get(['apiSettings', 'filterSettings']);
  const apiSettings = settings.apiSettings;
  
  const apiKey = apiSettings?.provider === 'openai' ? apiSettings.openaiKey : 
                 apiSettings?.provider === 'gemini' ? apiSettings.geminiKey :
                 apiSettings?.provider === 'deepseek' ? apiSettings.deepseekKey : '';
  
  if (!apiSettings?.autoClassify || !apiKey) {
    // AI自动分类未启用或未配置API
    return;
  }
  
  // 如果不是URL书签，可能是文件夹或者信息不完整
  if (!bookmark.url) {
    // 书签URL为空，等待100ms后重试获取
    
    // 延迟一下再获取，给Chrome时间更新书签信息
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const [fullBookmark] = await chrome.bookmarks.get(id);
      if (fullBookmark && fullBookmark.url) {
        bookmark = fullBookmark;
      } else {
        return;
      }
    } catch (error) {
      return;
    }
  }
  
  // 检查是否应该过滤这个书签
  const filterSettings = await loadFilterSettings();
  const shouldFilter = await shouldFilterBookmark(bookmark, filterSettings);
  
  if (!shouldFilter) {
    // 获取页面元数据
    let metadata = pageMetadataCache.get(bookmark.url);
    
    // 如果缓存中没有，尝试从当前标签页获取
    if (!metadata) {
      try {
        const tabs = await chrome.tabs.query({ url: bookmark.url });
        if (tabs.length > 0 && tabs[0].id) {
          metadata = await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_METADATA' });
        }
      } catch (error) {
        logger.error('获取页面元数据失败:', error);
      }
    }
    
    // 获取原始位置
    let fromFolder = '';
    if (bookmark.parentId) {
      try {
        const [parent] = await chrome.bookmarks.get(bookmark.parentId);
        fromFolder = parent.title || '';
      } catch (e) {
        // 忽略错误
      }
    }
    
    // 检查书签是否已经在一个有意义的文件夹中（不是书签栏根目录）
    const parentFolder = await getParentFolderName(bookmark.parentId || '');
    const isInRootFolder = bookmark.parentId === '1' || bookmark.parentId === '2' || !parentFolder;
    
    // 检查是否在智能分类文件夹或其子文件夹中
    const inSmartFolder = await isInSmartFolder(bookmark);
    
    if (!isInRootFolder && parentFolder && parentFolder !== '书签栏' && parentFolder !== 'Bookmarks Bar' && !inSmartFolder) {
      // 如果用户将书签放在了其他文件夹（非智能分类文件夹），我们仍然进行AI分类
      // 但会检查AI推荐的文件夹是否与当前文件夹不同
      // 书签当前在其他文件夹中，将进行AI分类
    }
    
    // 总是进行AI分类，除非被过滤
    // 添加延迟，让Chrome完成其默认操作
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await classifyBookmark(bookmark, metadata, { 
      ...apiSettings, 
      apiKey,
      linkPreviewKey: apiSettings.linkPreviewKey,
      linkPreviewKeys: apiSettings.linkPreviewKeys 
    }, fromFolder);
  } else {
    // 书签被过滤，不进行AI处理
  }
  
  // 记录这个书签刚被创建，用于在onChanged事件中识别
  if (bookmark.id) {
    recentlyCreatedBookmarks.add(bookmark.id);
    // 5秒后清除标记，避免内存泄漏
    setTimeout(() => {
      recentlyCreatedBookmarks.delete(bookmark.id);
      
      // 最终验证：5秒后再次检查书签位置
      chrome.bookmarks.get(bookmark.id).then(([finalBookmark]) => {
        getParentFolderName(finalBookmark.parentId).then(finalFolder => {
          // logger.debug(`[5秒后最终验证] 书签 "${finalBookmark.title}" 最终位于: "${finalFolder}" 文件夹`);
        });
      }).catch(err => {
        // 书签可能已被删除
      });
    }, 5000);
  }
  
  // 可选：添加短暂延迟，让用户有机会手动选择文件夹
  // 如果用户在这期间移动了书签，插件会跳过处理
  // await new Promise(resolve => setTimeout(resolve, 1000));
});

// 监听书签移动事件
chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
  const timestamp = new Date().toISOString();
  logger.warn(`[${timestamp}] 检测到书签移动事件:`, {
    bookmarkId: id,
    oldParentId: moveInfo.oldParentId,
    oldIndex: moveInfo.oldIndex,
    parentId: moveInfo.parentId,
    index: moveInfo.index,
    isOurMove: movingBookmarks.has(id)
  });
  
  // 获取书签信息
  try {
    const [bookmark] = await chrome.bookmarks.get(id);
    const oldParentName = await getParentFolderName(moveInfo.oldParentId);
    const newParentName = await getParentFolderName(moveInfo.parentId);
    
    if (!movingBookmarks.has(id)) {
      // 用户手动移动书签 - 这是重要的学习机会！
      logger.info('✅ 检测到用户手动操作:', {
        title: bookmark.title,
        url: bookmark.url,
        从: oldParentName,
        到: newParentName
      });

      // 学习用户的分类偏好
      if (bookmark.url && newParentName) {
        try {
          // 将用户的手动分类保存到缓存，并永久锁定
          await classificationCache.setCachedClassification(
            bookmark.url,
            newParentName,
            1.0,  // 用户手动 = 100%置信度
            'manual',
            true  // 永久锁定
          );

          logger.info(`✅ 已学习用户偏好: ${bookmark.url} → ${newParentName} (永久锁定)`);

          // 如果之前有预期位置，清除它（尊重用户的选择）
          expectedLocations.delete(id);

          // 记录用户纠正的案例（用于未来的偏好学习）
          const expectedFolder = expectedLocations.get(id);
          if (expectedFolder && expectedFolder !== newParentName) {
            logger.info(`📚 用户纠正: AI建议="${expectedFolder}" → 用户选择="${newParentName}"`);
            // TODO: 未来可以基于这些数据训练用户偏好模型
          }
        } catch (error) {
          logger.error('保存用户偏好失败:', error);
        }
      }
    } else {
      // 这是我们插件的移动操作
      logger.debug('插件自动移动书签', {
        title: bookmark.title,
        从: oldParentName,
        到: newParentName
      });
    }
  } catch (error) {
    logger.error('获取移动书签信息失败:', error);
  }
});

// 监听书签变更事件
chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  // logger.debug('书签更新事件触发:', id, changeInfo);
  
  // 检查是否是刚创建的书签的第一次更新
  const isRecentlyCreated = recentlyCreatedBookmarks.has(id);
  if (isRecentlyCreated) {
    recentlyCreatedBookmarks.delete(id);
    // 这是新创建书签的首次更新
  }
  
  // 如果标题或URL发生变化，可能需要重新分类
  if (changeInfo.title || changeInfo.url || isRecentlyCreated) {
    const settings = await chrome.storage.sync.get(['apiSettings']);
    const apiSettings = settings.apiSettings;
    
    const apiKey = apiSettings?.provider === 'openai' ? apiSettings.openaiKey : 
                 apiSettings?.provider === 'gemini' ? apiSettings.geminiKey :
                 apiSettings?.provider === 'deepseek' ? apiSettings.deepseekKey : '';
    
    if (!apiSettings?.autoClassify || !apiKey) {
      // AI自动分类未启用或未配置API
      return;
    }
    
    const [bookmark] = await chrome.bookmarks.get(id);
    if (bookmark && bookmark.url) {
      // 准备对更新后的书签进行分类
      
      // 检查是否已经在智能分类文件夹中
      const inSmartFolder = await isInSmartFolder(bookmark);
      if (inSmartFolder) {
        // 书签已在智能分类文件夹中，跳过
        return;
      }
      
      // 获取原始位置
      let fromFolder = '';
      if (bookmark.parentId) {
        try {
          const [parent] = await chrome.bookmarks.get(bookmark.parentId);
          fromFolder = parent.title || '';
        } catch (e) {
          // 忽略错误
        }
      }
      
      // 尝试获取页面元数据
      const metadata = pageMetadataCache.get(bookmark.url);
      await classifyBookmark(bookmark, metadata, { 
        ...apiSettings, 
        apiKey,
        linkPreviewKey: apiSettings.linkPreviewKey,
        linkPreviewKeys: apiSettings.linkPreviewKeys 
      }, fromFolder);
    }
  }
});

/**
 * 使用AI对书签进行智能分类
 * @param bookmark 书签对象
 * @param metadata 页面元数据
 * @param apiSettings API设置
 * @param fromFolder 原始文件夹
 * @param isBatchMode 是否批量模式
 */
async function classifyBookmark(bookmark: chrome.bookmarks.BookmarkTreeNode, metadata: any, apiSettings: any, fromFolder?: string, isBatchMode: boolean = false) {
  try {
    // logger.debug('开始分类书签:', bookmark.title);
    
    if (!bookmark.url || !bookmark.title) {
      // 书签缺少必要信息，跳过分类
      return;
    }
    
    // 准备书签信息
    const bookmarkInfo = {
      title: bookmark.title,
      url: bookmark.url,
      description: metadata?.description,
      keywords: metadata?.keywords
    };
    
    // 调用AI进行分类
    const result = await aiClassifyBookmark(bookmarkInfo, apiSettings);
    // logger.debug('AI分类结果:', result);
    
    // 如果置信度高于阈值，则自动分类
    if (result.confidence > 0.7) {
      // 如果有建议的标题且启用了标题优化，先更新书签标题
      if (result.suggestedTitle && result.suggestedTitle !== bookmark.title && apiSettings.optimizeTitle !== false) {
        try {
          await chrome.bookmarks.update(bookmark.id!, {
            title: result.suggestedTitle
          });
          // 更新本地对象的标题
          bookmark.title = result.suggestedTitle;
          
          await showNotification(
            '书签标题已优化',
            `"${bookmarkInfo.title}" → "${result.suggestedTitle}"`,
            'info'
          );
        } catch (error) {
          logger.error('更新书签标题失败:', error);
        }
      }
      
      await moveBookmarkToCategory(bookmark, result.category, isBatchMode);
      
      // 记录到历史
      await organizeHistory.addRecord({
        bookmarkId: bookmark.id!,
        bookmarkTitle: bookmark.title,
        bookmarkUrl: bookmark.url!,
        fromFolder: fromFolder || '',
        toFolder: result.category,
        timestamp: Date.now(),
        confidence: result.confidence,
        reasoning: result.reasoning,
        status: 'completed'
      });
    } else {
      // 分类置信度较低，跳过自动分类
    }
    
  } catch (error) {
    logger.error('书签分类失败:', error);
    // 如果AI分类失败，使用备用的简单分类
    const category = await simulateAIClassification(bookmark);
    if (category) {
      await moveBookmarkToCategory(bookmark, category, isBatchMode);
    }
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
 * 获取父文件夹名称
 * @param parentId 父文件夹ID
 * @returns 父文件夹名称
 */
async function getParentFolderName(parentId: string): Promise<string> {
  try {
    const [parent] = await chrome.bookmarks.get(parentId);
    return parent.title || '';
  } catch (error) {
    return '';
  }
}

/**
 * 将书签移动到指定分类文件夹
 * @param bookmark 书签对象
 * @param category 分类名称
 * @param isBatchMode 是否批量模式
 */
async function moveBookmarkToCategory(bookmark: chrome.bookmarks.BookmarkTreeNode, category: string, isBatchMode: boolean = false) {
  try {
    // logger.debug('开始移动书签:', bookmark.title, '->', category);
    
    // 检查是否正在移动中
    if (bookmark.id && movingBookmarks.has(bookmark.id)) {
      // 书签正在移动中，跳过避免竞态条件
      return;
    }
    
    // 标记开始移动
    if (bookmark.id) {
      movingBookmarks.add(bookmark.id);
    }
    
    // 获取当前父文件夹名称
    const currentParentFolder = bookmark.parentId ? await getParentFolderName(bookmark.parentId) : '';
    
    // 检查是否已处理过，但如果当前不在目标文件夹中，仍然需要移动
    if (bookmark.id && processedBookmarks.has(bookmark.id) && currentParentFolder === category) {
      // 书签已处理过且在正确的文件夹中，跳过
      if (bookmark.id) movingBookmarks.delete(bookmark.id);
      return;
    }
    
    // 查找或创建分类文件夹
    const categoryFolder = await findOrCreateFolder(category, isBatchMode);
    
    // 检查书签是否已经在目标文件夹中
    if (categoryFolder && bookmark.id) {
      if (bookmark.parentId === categoryFolder.id) {
        // 书签已经在目标文件夹中，无需移动
        // 仍然记录为已处理
        if (bookmark.id) {
          processedBookmarks.add(bookmark.id);
          await saveProcessedBookmarks();
        }
        return;
      }
      
      // 执行移动操作
      const movedBookmark = await chrome.bookmarks.move(bookmark.id, {
        parentId: categoryFolder.id
      });
      
      // 记录已处理
      processedBookmarks.add(bookmark.id);
      await saveProcessedBookmarks();
      
      // 显示成功通知，包含原始位置信息
      const message = currentParentFolder && currentParentFolder !== category 
        ? `"${bookmark.title}" 已从 "${currentParentFolder}" 移动到 "${category}" 文件夹`
        : `"${bookmark.title}" 已移动到 "${category}" 文件夹`;
      
      await showNotification(
        '书签已智能分类',
        message,
        'success'
      );
      
      // 记录预期位置
      if (bookmark.id) {
        expectedLocations.set(bookmark.id, category);
        // 10秒后清理
        setTimeout(() => {
          expectedLocations.delete(bookmark.id);
        }, 10000);
      }
      
      // 清除移动标记
      if (bookmark.id) {
        movingBookmarks.delete(bookmark.id);
      }
    } else {
      logger.error('无法创建或找到目标文件夹:', category);
      
      // 清除移动标记
      if (bookmark.id) {
        movingBookmarks.delete(bookmark.id);
      }
    }
  } catch (error) {
    logger.error('移动书签失败:', error);
    
    // 清除移动标记
    if (bookmark.id) {
      movingBookmarks.delete(bookmark.id);
    }
    
    await showNotification(
      '整理失败',
      `无法移动书签 "${bookmark.title}": ${error instanceof Error ? error.message : '未知错误'}`,
      'error'
    );
  }
}

/**
 * 测试API连接
 * @param apiSettings API设置
 * @returns 测试结果
 */
async function testAPIConnection(apiSettings: any) {
  // logger.debug('开始测试API连接:', apiSettings.provider);
  
  try {
    if (apiSettings.provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiSettings.apiKey}`
        }
      });
      
      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error?.message || '无效的API密钥' };
      }
    } else if (apiSettings.provider === 'gemini') {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiSettings.apiKey}`);
      
      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error?.message || '无效的API密钥' };
      }
    } else if (apiSettings.provider === 'deepseek') {
      // Deepseek 使用兼容 OpenAI 的 API，可以使用 models 端点测试
      const response = await fetch('https://api.deepseek.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiSettings.apiKey}`
        }
      });
      
      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.error?.message || '无效的API密钥' };
      }
    }
    
    return { success: false, error: '不支持的AI提供商' };
  } catch (error) {
    logger.error('测试API连接失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '网络连接失败' };
  }
}

/**
 * 查找或创建文件夹
 * @param folderName 文件夹名称
 * @param forceSmartFolder 是否强制使用智能分类文件夹
 * @returns 文件夹对象
 */
async function findOrCreateFolder(folderName: string, forceSmartFolder: boolean = false): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  try {
    // logger.debug(`\\n[findOrCreateFolder] 开始查找或创建文件夹: "${folderName}", forceSmartFolder: ${forceSmartFolder}`);
    
    // 获取书签树
    const bookmarkTree = await chrome.bookmarks.getTree();
    
    // 查找书签栏 - Chrome的根节点通常有三个子节点
    // [0] 是根节点，其子节点包括：书签栏(id="1")、其他书签(id="2")、移动设备书签(id="3")
    let bookmarkBarNode = bookmarkTree[0].children?.find(node => node.id === '1');
    
    // 如果通过ID找不到，尝试通过标题查找（支持多语言）
    if (!bookmarkBarNode) {
      bookmarkBarNode = bookmarkTree[0].children?.find(node => 
        node.title === '书签栏' || 
        node.title === 'Bookmarks Bar' ||
        node.title === 'Bookmarks bar' ||
        node.id === '1'
      );
    }
    
    if (!bookmarkBarNode) {
      logger.error('找不到书签栏，尝试使用其他书签文件夹');
      // 使用"其他书签"作为备选
      bookmarkBarNode = bookmarkTree[0].children?.find(node => node.id === '2');
      if (!bookmarkBarNode) {
        logger.error('找不到任何可用的书签文件夹');
        return null;
      }
    }
    
    // 1. 首先在书签栏根目录查找匹配的文件夹
    let categoryFolder = bookmarkBarNode.children?.find(node => 
      node.title === folderName && !node.url
    );
    
    if (categoryFolder) {
      logger.debug(`[findOrCreateFolder] 在书签栏找到已有文件夹: "${folderName}" (ID: ${categoryFolder.id})`);
      return categoryFolder;
    }
    
    // 2. 在智能分类文件夹中查找（如果存在的话）
    const smartFolder = bookmarkBarNode.children?.find(node => node.title === '智能分类');
    if (smartFolder) {
      // 重新获取smartFolder以确保有最新的children
      const [updatedSmartFolder] = await chrome.bookmarks.getSubTree(smartFolder.id);
      categoryFolder = updatedSmartFolder.children?.find(node => node.title === folderName);
      
      if (categoryFolder) {
        logger.debug(`使用智能分类中的文件夹: ${folderName}`);
        return categoryFolder;
      }
    }
    
    // 3. 获取用户的文件夹策略设置
    const settings = await chrome.storage.sync.get(['apiSettings']);
    const folderStrategy = settings.apiSettings?.folderStrategy || 'smart';
    
    // 4. 检查是否正在批量整理（通过检查是否有智能分类文件夹）
    const isBatchOrganizing = !!smartFolder || forceSmartFolder;
    
    // 5. 决定在哪里创建新文件夹
    if (folderStrategy === 'always_smart_folder' || isBatchOrganizing) {
      // 传统模式或批量整理时，使用智能分类文件夹
      let targetFolder = smartFolder;
      if (!targetFolder) {
        // 创建智能分类文件夹
        targetFolder = await chrome.bookmarks.create({
          parentId: bookmarkBarNode.id,
          title: '智能分类'
        });
      }
      
      const newFolder = await chrome.bookmarks.create({
        parentId: targetFolder.id,
        title: folderName
      });
      return newFolder;
    } else {
      // 智能模式：单个书签直接在书签栏创建
      logger.debug(`智能模式：在书签栏创建文件夹 "${folderName}"`);
      return await chrome.bookmarks.create({
        parentId: bookmarkBarNode.id,
        title: folderName
      });
    }
  } catch (error) {
    logger.error('创建文件夹失败:', error);
    return null;
  }
}

// 用于控制整理过程的全局变量
let isOrganizePaused = false;
let currentOrganizeBookmarks: chrome.bookmarks.BookmarkTreeNode[] = [];

// 监听来自内容脚本和其他页面的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PAGE_METADATA' && sender.tab?.url) {
    // 缓存页面元数据
    pageMetadataCache.set(sender.tab.url, request.data);
    
    // 设置过期时间（5分钟）
    setTimeout(() => {
      pageMetadataCache.delete(sender.tab.url);
    }, 5 * 60 * 1000);
    
    sendResponse({ success: true });
    return false;
  } else if (request.type === 'TEST_API') {
    // 测试API连接
    testAPIConnection(request.apiSettings).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // 保持消息通道开放
  } else if (request.action === 'batchOrganize') {
    // 使用async函数处理批量整理
    (async () => {
      try {
      // 开始批量整理书签
      
      // 获取所有书签
      const bookmarks = await chrome.bookmarks.getTree();
      const allBookmarks = flattenBookmarks(bookmarks);
      
      // 开始新的整理会话
      const sessionId = await organizeHistory.startSession(allBookmarks.length);
      
      // 确保智能分类文件夹存在（批量整理时）
      const bookmarkTree = await chrome.bookmarks.getTree();
      const bookmarkBarNode = bookmarkTree[0].children?.find(node => node.id === '1');
      if (bookmarkBarNode && !bookmarkBarNode.children?.find(node => node.title === '智能分类')) {
        await chrome.bookmarks.create({
          parentId: bookmarkBarNode.id,
          title: '智能分类'
        });
        logger.debug('创建智能分类临时文件夹');
      }
      
      // 获取过滤器设置
      const filterSettings = await loadFilterSettings();
      
      // 过滤出需要整理的书签
      const bookmarksToOrganize = [];
      for (const bookmark of allBookmarks) {
        if (!bookmark.url) continue;
        
        // 检查是否在智能分类文件夹中
        const inSmartFolder = await isInSmartFolder(bookmark);
        if (inSmartFolder) continue;
        
        // 检查是否已处理过
        if (bookmark.id && processedBookmarks.has(bookmark.id)) continue;
        
        // 检查是否应该被过滤
        const shouldFilter = await shouldFilterBookmark(bookmark, filterSettings);
        if (shouldFilter) {
          // 书签被过滤，跳过处理
          continue;
        }
        
        bookmarksToOrganize.push(bookmark);
      }
      
      // 获取API设置
      const settings = await chrome.storage.sync.get(['apiSettings']);
      const apiSettings = settings.apiSettings;
      
      const apiKey = apiSettings?.provider === 'openai' ? apiSettings.openaiKey : 
                 apiSettings?.provider === 'gemini' ? apiSettings.geminiKey :
                 apiSettings?.provider === 'deepseek' ? apiSettings.deepseekKey : '';
      
      if (!apiKey) {
        sendResponse({ success: false, error: '请先配置API密钥' });
        return;
      }
      
      // 显示开始通知
      await showNotification(
        '开始智能整理',
        `准备处理 ${bookmarksToOrganize.length} 个书签`,
        'info'
      );
      
      // 保存当前要整理的书签列表
      currentOrganizeBookmarks = bookmarksToOrganize;
      isOrganizePaused = false;
      
      // 批量分类
      for (let i = 0; i < bookmarksToOrganize.length; i++) {
        // 检查是否暂停
        if (isOrganizePaused) {
          logger.debug('整理已暂停，位置:', i);
          
          // 获取剩余未处理的书签ID
          const remainingBookmarkIds = bookmarksToOrganize.slice(i).map(b => b.id).filter(id => id) as string[];
          
          // 暂停会话
          await organizeHistory.pauseSession(remainingBookmarkIds);
          
          // 发送暂停消息到popup
          chrome.runtime.sendMessage({
            type: 'ORGANIZE_PAUSED',
            current: i,
            total: bookmarksToOrganize.length
          }).catch(() => {});
          
          sendResponse({ success: false, paused: true, processed: i });
          return;
        }
        
        const bookmark = bookmarksToOrganize[i];
        
        // 显示进度
        await showProgressNotification(i + 1, bookmarksToOrganize.length, bookmark.title);
        
        // 发送进度消息到popup
        chrome.runtime.sendMessage({
          type: 'ORGANIZE_PROGRESS',
          current: i + 1,
          total: bookmarksToOrganize.length,
          bookmarkTitle: bookmark.title
        }).catch(() => {
          // 忽略错误（popup可能已关闭）
        });
        
        // 批量整理时不获取元数据，直接使用缓存或空值
        const metadata = pageMetadataCache.get(bookmark.url || '');
        
        // 记录原始位置
        let fromFolder = '';
        if (bookmark.parentId) {
          try {
            const [parent] = await chrome.bookmarks.get(bookmark.parentId);
            fromFolder = parent.title || '';
          } catch (e) {
            // 忽略错误
          }
        }
        
        await classifyBookmark(bookmark, metadata, { 
          ...apiSettings, 
          apiKey,
          linkPreviewKey: apiSettings.linkPreviewKey,
          linkPreviewKeys: apiSettings.linkPreviewKeys 
        }, fromFolder, true);
        // 添加延迟避免过快调用（增加延迟时间以避免LinkPreview API 429错误）
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 清除进度通知
      await clearProgressNotification();
      
      // 结束会话
      await organizeHistory.endSession('completed');
      
      // 显示完成通知
      await showNotification(
        '智能整理完成',
        `成功处理 ${bookmarksToOrganize.length} 个书签`,
        'success'
      );
      
      // 发送完成消息到popup
      chrome.runtime.sendMessage({
        type: 'ORGANIZE_COMPLETE',
        total: bookmarksToOrganize.length
      }).catch(() => {
        // 忽略错误
      });
      
      sendResponse({ success: true, processed: bookmarksToOrganize.length });
      } catch (error) {
        logger.error('批量整理失败:', error);
        
        // 结束会话（错误状态）
        await organizeHistory.endSession('error');
        
        // 发送错误消息到popup
        chrome.runtime.sendMessage({
          type: 'ORGANIZE_ERROR',
          error: error instanceof Error ? error.message : '未知错误'
        }).catch(() => {
          // 忽略错误（popup可能已关闭）
        });
        
        await showNotification(
          '整理失败',
          `批量整理出错: ${error instanceof Error ? error.message : '未知错误'}`,
          'error'
        );
        
        sendResponse({ success: false, error: error instanceof Error ? error.message : '未知错误' });
      }
    })();
    return true; // 保持消息通道开放
  } else if (request.action === 'organizeSingleFolder') {
    // 处理单个文件夹整理
    (async () => {
      try {
        logger.debug('开始整理文件夹:', request.folderId);
        
        // 获取API设置
        const settings = await chrome.storage.sync.get(['apiSettings']);
        const apiSettings = settings.apiSettings;
        
        const apiKey = apiSettings?.provider === 'openai' ? apiSettings.openaiKey : 
                 apiSettings?.provider === 'gemini' ? apiSettings.geminiKey :
                 apiSettings?.provider === 'deepseek' ? apiSettings.deepseekKey : '';
        
        if (!apiKey) {
          sendResponse({ success: false, error: '请先配置API密钥' });
          return;
        }
        
        // 获取文件夹中的所有书签
        const folderBookmarks = await chrome.bookmarks.getChildren(request.folderId);
        const bookmarksToOrganize = folderBookmarks.filter(bookmark => 
          bookmark.url && !processedBookmarks.has(bookmark.id)
        );
        
        // 批量分类
        for (const bookmark of bookmarksToOrganize) {
          const metadata = pageMetadataCache.get(bookmark.url || '');
          await classifyBookmark(bookmark, metadata, { 
            ...apiSettings, 
            apiKey,
            linkPreviewKey: apiSettings.linkPreviewKey,
            linkPreviewKeys: apiSettings.linkPreviewKeys 
          });
          // 添加延迟避免过快调用
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        sendResponse({ success: true, processed: bookmarksToOrganize.length });
      } catch (error) {
        logger.error('文件夹整理失败:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : '未知错误' });
      }
    })();
    return true; // 保持消息通道开放
  } else if (request.action === 'previewOrganize') {
    // 预览整理（不实际移动）
    (async () => {
      try {
        logger.debug('开始预览整理...');
        
        // 获取所有书签
        const bookmarks = await chrome.bookmarks.getTree();
        const allBookmarks = flattenBookmarks(bookmarks);
        
        // 获取过滤器设置
        const filterSettings = await loadFilterSettings();
        
        // 过滤出需要整理的书签
        const bookmarksToOrganize = [];
        for (const bookmark of allBookmarks) {
          if (!bookmark.url) continue;
          
          // 检查是否在智能分类文件夹中
          const inSmartFolder = await isInSmartFolder(bookmark);
          if (inSmartFolder) continue;
          
          // 检查是否已处理过
          if (bookmark.id && processedBookmarks.has(bookmark.id)) continue;
          
          // 检查是否应该被过滤
          const shouldFilter = await shouldFilterBookmark(bookmark, filterSettings);
          if (shouldFilter) {
            // 书签被过滤，跳过处理
            continue;
          }
          
          bookmarksToOrganize.push(bookmark);
        }
        
        // 获取API设置
        const settings = await chrome.storage.sync.get(['apiSettings']);
        const apiSettings = settings.apiSettings;
        
        const apiKey = apiSettings?.provider === 'openai' ? apiSettings.openaiKey : 
                 apiSettings?.provider === 'gemini' ? apiSettings.geminiKey :
                 apiSettings?.provider === 'deepseek' ? apiSettings.deepseekKey : '';
        
        if (!apiKey) {
          sendResponse({ success: false, error: '请先配置API密钥' });
          return;
        }
        
        // 收集预览结果
        const previewResults = [];
        
        for (const bookmark of bookmarksToOrganize.slice(0, 10)) { // 只预览前10个
          try {
            const metadata = pageMetadataCache.get(bookmark.url || '');
            const bookmarkInfo = {
              title: bookmark.title,
              url: bookmark.url,
              description: metadata?.description,
              keywords: metadata?.keywords
            };
            
            const result = await aiClassifyBookmark(bookmarkInfo, { 
              provider: apiSettings.provider,
              apiKey: apiKey,
              model: apiSettings.model,
              linkPreviewKey: apiSettings.linkPreviewKey,
              linkPreviewKeys: apiSettings.linkPreviewKeys 
            });
            previewResults.push({
              bookmark: {
                id: bookmark.id,
                title: bookmark.title,
                url: bookmark.url
              },
              suggestion: {
                category: result.category,
                confidence: result.confidence,
                reasoning: result.reasoning
              }
            });
          } catch (error) {
            logger.error('预览书签分类失败:', error);
          }
          
          // 添加延迟
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 保存预览结果供预览页面使用
        await chrome.storage.local.set({ previewResults });
        
        sendResponse({ success: true, results: previewResults });
      } catch (error) {
        logger.error('预览失败:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : '未知错误' });
      }
    })();
    return true; // 保持消息通道开放
  } else if (request.action === 'moveBookmark') {
    // 处理单个书签移动
    (async () => {
      try {
        const bookmark = await chrome.bookmarks.get(request.bookmarkId);
        if (bookmark.length > 0) {
          // 获取原始位置
          let fromFolder = '';
          if (bookmark[0].parentId) {
            try {
              const [parent] = await chrome.bookmarks.get(bookmark[0].parentId);
              fromFolder = parent.title || '';
            } catch (e) {
              // 忽略错误
            }
          }
          
          await moveBookmarkToCategory(bookmark[0], request.category);
          
          // 记录到历史
          await organizeHistory.addRecord({
            bookmarkId: bookmark[0].id!,
            bookmarkTitle: bookmark[0].title,
            bookmarkUrl: bookmark[0].url!,
            fromFolder,
            toFolder: request.category,
            timestamp: Date.now(),
            confidence: 1.0,
            reasoning: '手动移动',
            status: 'completed'
          });
          
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: '书签不存在' });
        }
      } catch (error) {
        logger.error('移动书签失败:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : '未知错误' });
      }
    })();
    return true; // 保持消息通道开放
  } else if (request.type === 'GET_ORGANIZE_HISTORY') {
    // 获取整理历史
    (async () => {
      try {
        const currentSession = await organizeHistory.getCurrentSession();
        const recentRecords = await organizeHistory.getRecentRecords(request.limit || 50);
        const history = await organizeHistory.getHistory(request.limit || 10);
        
        sendResponse({
          success: true,
          currentSession,
          recentRecords,
          history
        });
      } catch (error) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : '未知错误' });
      }
    })();
    return true;
  } else if (request.type === 'GET_UNPROCESSED_BOOKMARKS') {
    // 获取未处理的书签
    (async () => {
      try {
        const unprocessed = await organizeHistory.getUnprocessedBookmarks(request.includeAllFolders);
        sendResponse({ success: true, bookmarks: unprocessed });
      } catch (error) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : '未知错误' });
      }
    })();
    return true;
  } else if (request.type === 'CLEAR_PROCESSED_BOOKMARKS') {
    // 清理已处理记录
    (async () => {
      try {
        await organizeHistory.clearProcessedBookmarks();
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : '未知错误' });
      }
    })();
    return true;
  } else if (request.type === 'UNDO_ORGANIZE') {
    // 撤销整理操作
    (async () => {
      try {
        const success = await organizeHistory.undoRecord(request.recordId);
        sendResponse({ success });
      } catch (error) {
        sendResponse({ success: false, error: error instanceof Error ? error.message : '未知错误' });
      }
    })();
    return true;
  } else if (request.type === 'PAUSE_ORGANIZE') {
    // 暂停整理
    isOrganizePaused = true;
    sendResponse({ success: true });
    return false;
  } else if (request.type === 'RESUME_ORGANIZE') {
    // 恢复整理（重新开始）
    chrome.runtime.sendMessage({ action: 'batchOrganize' });
    sendResponse({ success: true });
    return false;
  }
  return false;
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
async function isInSmartFolder(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<boolean> {
  try {
    if (!bookmark.parentId) return false;
    
    let currentId = bookmark.parentId;
    
    // 向上遍历父节点，检查是否在"智能分类"文件夹下
    while (currentId) {
      const [parentNode] = await chrome.bookmarks.get(currentId);
      if (parentNode.title === '智能分类') {
        return true;
      }
      currentId = parentNode.parentId;
    }
    
    return false;
  } catch (error) {
    logger.error('检查书签位置失败:', error);
    return false;
  }
}