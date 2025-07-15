/**
 * 后台脚本 - 处理书签事件和AI分类逻辑
 */

import { shouldFilterBookmark, loadFilterSettings } from './utils/filter-utils';
import { classifyBookmark as aiClassifyBookmark } from './services/ai-service';
import { showNotification, showProgressNotification, clearProgressNotification } from './utils/notification';

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
    console.error('加载已处理书签记录失败:', error);
  }
}

// 保存已处理的书签记录
async function saveProcessedBookmarks() {
  try {
    await chrome.storage.local.set({
      processedBookmarks: Array.from(processedBookmarks)
    });
  } catch (error) {
    console.error('保存已处理书签记录失败:', error);
  }
}

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('智能书签管理器已安装');
  
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

// 监听新书签创建事件
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log('新书签创建:', bookmark);
  
  // 检查是否启用自动分类和API配置
  const settings = await chrome.storage.sync.get(['apiSettings', 'filterSettings']);
  const apiSettings = settings.apiSettings;
  
  const apiKey = apiSettings?.provider === 'openai' ? apiSettings.openaiKey : apiSettings?.geminiKey;
  
  if (!apiSettings?.autoClassify || !apiKey) {
    console.log('AI自动分类未启用或未配置API');
    return;
  }
  
  // 如果不是URL书签，跳过
  if (!bookmark.url) {
    return;
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
        console.error('获取页面元数据失败:', error);
      }
    }
    
    // 如果不需要过滤，则进行AI分类
    await classifyBookmark(bookmark, metadata, { ...apiSettings, apiKey });
  } else {
    console.log(`书签 "${bookmark.title}" 被过滤，不进行AI处理`);
  }
});

// 监听书签变更事件
chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  console.log('书签更新:', id, changeInfo);
  
  // 如果标题或URL发生变化，可能需要重新分类
  if (changeInfo.title || changeInfo.url) {
    const settings = await chrome.storage.sync.get(['apiSettings']);
    const apiSettings = settings.apiSettings;
    
    const apiKey = apiSettings?.provider === 'openai' ? apiSettings.openaiKey : apiSettings?.geminiKey;
    
    if (!apiSettings?.autoClassify || !apiKey) {
      return;
    }
    
    const bookmark = await chrome.bookmarks.get(id);
    if (bookmark.length > 0 && bookmark[0].url) {
      // 尝试获取页面元数据
      const metadata = pageMetadataCache.get(bookmark[0].url);
      await classifyBookmark(bookmark[0], metadata, { ...apiSettings, apiKey });
    }
  }
});

/**
 * 使用AI对书签进行智能分类
 * @param bookmark 书签对象
 * @param metadata 页面元数据
 * @param apiSettings API设置
 */
async function classifyBookmark(bookmark: chrome.bookmarks.BookmarkTreeNode, metadata: any, apiSettings: any) {
  try {
    console.log('开始分类书签:', bookmark.title);
    console.log('页面元数据:', metadata);
    
    if (!bookmark.url || !bookmark.title) {
      console.log('书签缺少必要信息，跳过分类');
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
    console.log('AI分类结果:', result);
    
    // 如果置信度高于阈值，则自动分类
    if (result.confidence > 0.7) {
      await moveBookmarkToCategory(bookmark, result.category);
      console.log(`书签已自动分类到: ${result.category} (置信度: ${result.confidence})`);
    } else {
      console.log(`分类置信度较低 (${result.confidence})，跳过自动分类`);
      // TODO: 可以通过通知让用户确认
    }
    
  } catch (error) {
    console.error('书签分类失败:', error);
    // 如果AI分类失败，使用备用的简单分类
    const category = await simulateAIClassification(bookmark);
    if (category) {
      await moveBookmarkToCategory(bookmark, category);
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
 * 将书签移动到指定分类文件夹
 * @param bookmark 书签对象
 * @param category 分类名称
 */
async function moveBookmarkToCategory(bookmark: chrome.bookmarks.BookmarkTreeNode, category: string) {
  try {
    // 检查是否已处理过
    if (bookmark.id && processedBookmarks.has(bookmark.id)) {
      console.log(`书签 "${bookmark.title}" 已处理过，跳过`);
      return;
    }
    
    // 查找或创建分类文件夹
    const categoryFolder = await findOrCreateFolder(category);
    
    // 移动书签到分类文件夹
    if (categoryFolder && bookmark.id) {
      await chrome.bookmarks.move(bookmark.id, {
        parentId: categoryFolder.id
      });
      console.log(`书签 "${bookmark.title}" 已移动到 "${category}" 文件夹`);
      
      // 记录已处理
      processedBookmarks.add(bookmark.id);
      await saveProcessedBookmarks();
      
      // 显示成功通知
      await showNotification(
        '书签已整理',
        `"${bookmark.title}" 已移动到 "${category}" 文件夹`,
        'success'
      );
    }
  } catch (error) {
    console.error('移动书签失败:', error);
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
  console.log('开始测试API连接:', apiSettings.provider);
  
  try {
    if (apiSettings.provider === 'openai') {
      console.log('测试OpenAI API...');
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiSettings.apiKey}`
        }
      });
      
      console.log('OpenAI响应状态:', response.status);
      
      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.json();
        console.error('OpenAI API错误:', error);
        return { success: false, error: error.error?.message || '无效的API密钥' };
      }
    } else if (apiSettings.provider === 'gemini') {
      console.log('测试Gemini API...');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiSettings.apiKey}`);
      
      console.log('Gemini响应状态:', response.status);
      
      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.json();
        console.error('Gemini API错误:', error);
        return { success: false, error: error.error?.message || '无效的API密钥' };
      }
    }
    
    return { success: false, error: '不支持的AI提供商' };
  } catch (error) {
    console.error('测试API连接失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '网络连接失败' };
  }
}

/**
 * 查找或创建文件夹
 * @param folderName 文件夹名称
 * @returns 文件夹对象
 */
async function findOrCreateFolder(folderName: string): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  try {
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
      console.error('找不到书签栏，尝试使用其他书签文件夹');
      // 使用"其他书签"作为备选
      bookmarkBarNode = bookmarkTree[0].children?.find(node => node.id === '2');
      if (!bookmarkBarNode) {
        console.error('找不到任何可用的书签文件夹');
        return null;
      }
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
    console.log('收到测试API请求:', request);
    // 测试API连接
    testAPIConnection(request.apiSettings).then(result => {
      console.log('API测试结果:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('API测试异常:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // 保持消息通道开放
  } else if (request.action === 'batchOrganize') {
    // 使用async函数处理批量整理
    (async () => {
      try {
      console.log('开始批量整理书签...');
      
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
          console.log(`书签 "${bookmark.title}" 被过滤，跳过处理`);
          continue;
        }
        
        bookmarksToOrganize.push(bookmark);
      }
      
      // 获取API设置
      const settings = await chrome.storage.sync.get(['apiSettings']);
      const apiSettings = settings.apiSettings;
      
      const apiKey = apiSettings?.provider === 'openai' ? apiSettings.openaiKey : apiSettings?.geminiKey;
      
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
      
      // 批量分类
      for (let i = 0; i < bookmarksToOrganize.length; i++) {
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
        
        const metadata = pageMetadataCache.get(bookmark.url || '');
        await classifyBookmark(bookmark, metadata, { ...apiSettings, apiKey });
        // 添加延迟避免过快调用
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 清除进度通知
      await clearProgressNotification();
      
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
        console.error('批量整理失败:', error);
        
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
        console.log('开始整理文件夹:', request.folderId);
        
        // 获取API设置
        const settings = await chrome.storage.sync.get(['apiSettings']);
        const apiSettings = settings.apiSettings;
        
        const apiKey = apiSettings?.provider === 'openai' ? apiSettings.openaiKey : apiSettings?.geminiKey;
        
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
          await classifyBookmark(bookmark, metadata, { ...apiSettings, apiKey });
          // 添加延迟避免过快调用
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        sendResponse({ success: true, processed: bookmarksToOrganize.length });
      } catch (error) {
        console.error('文件夹整理失败:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : '未知错误' });
      }
    })();
    return true; // 保持消息通道开放
  } else if (request.action === 'previewOrganize') {
    // 预览整理（不实际移动）
    (async () => {
      try {
        console.log('开始预览整理...');
        
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
            console.log(`书签 "${bookmark.title}" 被过滤，跳过处理`);
            continue;
          }
          
          bookmarksToOrganize.push(bookmark);
        }
        
        // 获取API设置
        const settings = await chrome.storage.sync.get(['apiSettings']);
        const apiSettings = settings.apiSettings;
        
        const apiKey = apiSettings?.provider === 'openai' ? apiSettings.openaiKey : apiSettings?.geminiKey;
        
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
              model: apiSettings.model 
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
            console.error('预览书签分类失败:', error);
          }
          
          // 添加延迟
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 保存预览结果供预览页面使用
        await chrome.storage.local.set({ previewResults });
        
        sendResponse({ success: true, results: previewResults });
      } catch (error) {
        console.error('预览失败:', error);
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
          await moveBookmarkToCategory(bookmark[0], request.category);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: '书签不存在' });
        }
      } catch (error) {
        console.error('移动书签失败:', error);
        sendResponse({ success: false, error: error instanceof Error ? error.message : '未知错误' });
      }
    })();
    return true; // 保持消息通道开放
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
    console.error('检查书签位置失败:', error);
    return false;
  }
}