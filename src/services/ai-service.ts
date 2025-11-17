/**
 * AI服务模块 - 处理与AI API的交互
 */

import { getDomainPattern } from './domain-patterns';
import { classificationCache } from './classification-cache';
import { linkPreviewService } from './linkpreview-service';
import { normalizeFolder, STANDARD_FOLDERS } from './folder-normalizer';
import { logger } from '~/utils/logger';

interface BookmarkInfo {
  title: string;
  url: string;
  description?: string;
  keywords?: string[];
}

interface ClassificationResult {
  category: string;
  confidence: number;
  reasoning?: string;
  suggestedTitle?: string;
}

/**
 * 调用OpenAI API进行书签分类
 */
async function classifyWithOpenAI(
  bookmarkInfo: BookmarkInfo,
  existingFolders: string[],
  apiKey: string,
  model: string
): Promise<ClassificationResult> {
  // 标准化现有文件夹名称
  const normalizedExisting = existingFolders.map(f => normalizeFolder(f));
  const uniqueFolders = [...new Set([...normalizedExisting, ...STANDARD_FOLDERS])].sort();

  const systemPrompt = `你是一个智能书签分类助手。你的任务是：
1. 根据书签的标题、URL和描述，将其分类到最合适的文件夹中
2. 为书签生成一个简洁清晰的标题

**重要规则 - 确保分类一致性**：
1. 对于相同或相似的内容，必须始终返回相同的分类
2. 只有在你非常确定(confidence >= 0.8)时才返回明确分类
3. 如果不确定，将confidence设置为较低值(< 0.8)，系统会提示用户确认

推荐的标准文件夹列表：
${uniqueFolders.map(f => `- ${f}`).join('\n')}

分类规则：
1. 必须选择上述列表中的文件夹
2. 优先选择最匹配的标准文件夹
3. 文件夹名称必须与列表中的完全一致
4. 考虑书签的主要用途和内容类型
5. 尽量使用现有文件夹，避免需要创建新分类

置信度评估标准：
- 0.9-1.0: 非常确定（如：github.com → 开发工具）
- 0.8-0.9: 很确定（如：技术博客 → 技术文档）
- 0.7-0.8: 比较确定，但可能有其他选择
- < 0.7: 不确定，需要用户确认

标题优化规则：
1. 提取核心内容，去除冗余信息
2. 去除括号中的次要信息、序号、网站后缀等
3. 保持简洁（建议10-20个字符）
4. 保留关键词和品牌名
5. 中文优先，除非是专有名词
6. 如果原标题过于通用（如 Explore、Home、Dashboard 等），必须从 URL 域名或描述中提取品牌/网站名称作为前缀
7. 始终确保标题能明确标识是哪个网站或服务

请以JSON格式返回结果，格式如下：
{
  "category": "文件夹名称",
  "confidence": 0.85,
  "reasoning": "分类理由（说明为什么选择这个分类）",
  "suggestedTitle": "优化后的标题"
}`;

  const userPrompt = `请对以下书签进行分类并优化标题：
原始标题：${bookmarkInfo.title}
URL：${bookmarkInfo.url}
${bookmarkInfo.description ? `描述：${bookmarkInfo.description}` : ''}
${bookmarkInfo.keywords?.length ? `关键词：${bookmarkInfo.keywords.join(', ')}` : ''}

请根据内容生成一个简洁的标题，例如：
- "(16) 「超詳細教學」n8n AI 實作..." → "n8n AI教程"
- "Bundle Disney+, Hulu, and ESPN+ | Bundle and Save" → "Disney+套餐"
- "Cursor Directory - Cursor Rules & MCP Servers" → "Cursor目录"
- "Explore" (来自 midjourney.com) → "Midjourney探索"
- "Dashboard" (来自 vercel.com) → "Vercel控制台"
- "Home" (来自 github.com) → "GitHub首页"`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('OpenAI API错误响应:', errorData);
      throw new Error(`OpenAI API错误: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // 安全的JSON解析，添加完善的错误处理
    try {
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('OpenAI响应内容为空');
      }

      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        logger.error('JSON解析失败，原始内容:', content);
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        throw new Error(`无法解析OpenAI返回的JSON: ${errorMessage}`);
      }

      // 验证返回的数据结构
      if (!result.category) {
        logger.warn('OpenAI返回缺少category字段:', result);
        result.category = '未分类';
      }

      if (typeof result.confidence !== 'number') {
        logger.warn('OpenAI返回缺少或错误的confidence字段:', result.confidence);
        result.confidence = 0.5;
      }

      // 验证置信度范围 [0, 1]
      if (result.confidence < 0 || result.confidence > 1) {
        logger.warn('置信度超出范围，已调整:', result.confidence);
        result.confidence = Math.max(0, Math.min(1, result.confidence));
      }

      // 标准化返回的分类名称
      const normalizedCategory = normalizeFolder(result.category);

      return {
        category: normalizedCategory,
        confidence: result.confidence,
        reasoning: result.reasoning || '无详细说明',
        suggestedTitle: result.suggestedTitle
      };

    } catch (parseError) {
      logger.error('处理OpenAI响应失败:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      // 返回降级结果而不是抛出异常
      return {
        category: '未分类',
        confidence: 0.3,
        reasoning: `AI分类失败: ${errorMessage}`,
        suggestedTitle: undefined
      };
    }
  } catch (error) {
    logger.error('OpenAI分类失败:', error);
    throw error;
  }
}

/**
 * 调用Gemini API进行书签分类
 */
async function classifyWithGemini(
  bookmarkInfo: BookmarkInfo,
  existingFolders: string[],
  apiKey: string,
  model: string
): Promise<ClassificationResult> {
  // 标准化现有文件夹名称
  const normalizedExisting = existingFolders.map(f => normalizeFolder(f));
  const uniqueFolders = [...new Set([...normalizedExisting, ...STANDARD_FOLDERS])].sort();
  
  const prompt = `作为一个智能书签分类助手，请完成以下任务：
1. 根据书签信息进行分类
2. 生成简洁的标题

推荐的标准文件夹：
${uniqueFolders.map(f => `- ${f}`).join('\n')}

书签信息：
- 原始标题：${bookmarkInfo.title}
- URL：${bookmarkInfo.url}
${bookmarkInfo.description ? `- 描述：${bookmarkInfo.description}` : ''}
${bookmarkInfo.keywords?.length ? `- 关键词：${bookmarkInfo.keywords.join(', ')}` : ''}

标题优化要求：
- 提取核心内容，去除冗余
- 10-20个字符为佳
- 去除序号、括号内容、网站后缀等
- 保持关键词和品牌名

返回JSON格式：{"category": "文件夹名称", "confidence": 0.8, "reasoning": "分类理由", "suggestedTitle": "优化后的标题"}`;

  try {
    // 注意：Google Gemini API 使用 URL 参数传递 API 密钥是其官方设计方式
    // 参考：https://ai.google.dev/gemini-api/docs/api-key
    // 虽然不是最佳实践，但这是 Google 的 API 规范
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 200
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Gemini API错误响应:', errorData);
      throw new Error(`Gemini API错误: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // 安全的JSON解析，添加完善的错误处理
    try {
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('Gemini响应内容为空');
      }

      // 提取JSON内容（Gemini可能返回markdown格式）
      const jsonMatch = text.match(/\{[^}]+\}/);
      if (!jsonMatch) {
        logger.error('无法从Gemini响应中提取JSON，原始内容:', text);
        throw new Error('无法解析Gemini返回的结果');
      }

      let result;
      try {
        result = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        logger.error('JSON解析失败，提取的内容:', jsonMatch[0]);
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        throw new Error(`无法解析Gemini返回的JSON: ${errorMessage}`);
      }

      // 验证返回的数据结构
      if (!result.category) {
        logger.warn('Gemini返回缺少category字段:', result);
        result.category = '未分类';
      }

      if (typeof result.confidence !== 'number') {
        logger.warn('Gemini返回缺少或错误的confidence字段:', result.confidence);
        result.confidence = 0.5;
      }

      // 验证置信度范围 [0, 1]
      if (result.confidence < 0 || result.confidence > 1) {
        logger.warn('置信度超出范围，已调整:', result.confidence);
        result.confidence = Math.max(0, Math.min(1, result.confidence));
      }

      // 标准化返回的分类名称
      const normalizedCategory = normalizeFolder(result.category);

      return {
        category: normalizedCategory,
        confidence: result.confidence,
        reasoning: result.reasoning || '无详细说明',
        suggestedTitle: result.suggestedTitle
      };

    } catch (parseError) {
      logger.error('处理Gemini响应失败:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      // 返回降级结果而不是抛出异常
      return {
        category: '未分类',
        confidence: 0.3,
        reasoning: `AI分类失败: ${errorMessage}`,
        suggestedTitle: undefined
      };
    }
  } catch (error) {
    logger.error('Gemini分类失败:', error);
    throw error;
  }
}

/**
 * 调用Deepseek API进行书签分类
 */
async function classifyWithDeepseek(
  bookmarkInfo: BookmarkInfo,
  existingFolders: string[],
  apiKey: string,
  model: string
): Promise<ClassificationResult> {
  // 标准化现有文件夹名称
  const normalizedExisting = existingFolders.map(f => normalizeFolder(f));
  const uniqueFolders = [...new Set([...normalizedExisting, ...STANDARD_FOLDERS])].sort();

  const systemPrompt = `你是一个智能书签分类助手。你的任务是：
1. 根据书签的标题、URL和描述，将其分类到最合适的文件夹中
2. 为书签生成一个简洁清晰的标题

**重要规则 - 确保分类一致性**：
1. 对于相同或相似的内容，必须始终返回相同的分类
2. 只有在你非常确定(confidence >= 0.8)时才返回明确分类
3. 如果不确定，将confidence设置为较低值(< 0.8)，系统会提示用户确认

推荐的标准文件夹列表：
${uniqueFolders.map(f => `- ${f}`).join('\n')}

分类规则：
1. 必须选择上述列表中的文件夹
2. 优先选择最匹配的标准文件夹
3. 文件夹名称必须与列表中的完全一致
4. 考虑书签的主要用途和内容类型
5. 尽量使用现有文件夹，避免需要创建新分类

置信度评估标准：
- 0.9-1.0: 非常确定（如：github.com → 开发工具）
- 0.8-0.9: 很确定（如：技术博客 → 技术文档）
- 0.7-0.8: 比较确定，但可能有其他选择
- < 0.7: 不确定，需要用户确认

标题优化规则：
1. 提取核心内容，去除冗余信息
2. 去除括号中的次要信息、序号、网站后缀等
3. 保持简洁（建议10-20个字符）
4. 保留关键词和品牌名
5. 中文优先，除非是专有名词
6. 如果原标题过于通用（如 Explore、Home、Dashboard 等），必须从 URL 域名或描述中提取品牌/网站名称作为前缀
7. 始终确保标题能明确标识是哪个网站或服务

请以JSON格式返回结果，格式如下：
{
  "category": "文件夹名称",
  "confidence": 0.85,
  "reasoning": "分类理由（说明为什么选择这个分类）",
  "suggestedTitle": "优化后的标题"
}`;

  const userPrompt = `请对以下书签进行分类并优化标题：
原始标题：${bookmarkInfo.title}
URL：${bookmarkInfo.url}
${bookmarkInfo.description ? `描述：${bookmarkInfo.description}` : ''}
${bookmarkInfo.keywords?.length ? `关键词：${bookmarkInfo.keywords.join(', ')}` : ''}

请根据内容生成一个简洁的标题，例如：
- "(16) 「超詳細教學」n8n AI 實作..." → "n8n AI教程"
- "Bundle Disney+, Hulu, and ESPN+ | Bundle and Save" → "Disney+套餐"
- "Cursor Directory - Cursor Rules & MCP Servers" → "Cursor目录"
- "Explore" (来自 midjourney.com) → "Midjourney探索"
- "Dashboard" (来自 vercel.com) → "Vercel控制台"
- "Home" (来自 github.com) → "GitHub首页"`;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Deepseek API错误响应:', errorData);
      throw new Error(`Deepseek API错误: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // 安全的JSON解析，添加完善的错误处理
    try {
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Deepseek响应内容为空');
      }

      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        logger.error('JSON解析失败，原始内容:', content);
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        throw new Error(`无法解析Deepseek返回的JSON: ${errorMessage}`);
      }

      // 验证返回的数据结构
      if (!result.category) {
        logger.warn('Deepseek返回缺少category字段:', result);
        result.category = '未分类';
      }

      if (typeof result.confidence !== 'number') {
        logger.warn('Deepseek返回缺少或错误的confidence字段:', result.confidence);
        result.confidence = 0.5;
      }

      // 验证置信度范围 [0, 1]
      if (result.confidence < 0 || result.confidence > 1) {
        logger.warn('置信度超出范围，已调整:', result.confidence);
        result.confidence = Math.max(0, Math.min(1, result.confidence));
      }

      // 标准化返回的分类名称
      const normalizedCategory = normalizeFolder(result.category);

      return {
        category: normalizedCategory,
        confidence: result.confidence,
        reasoning: result.reasoning || '无详细说明',
        suggestedTitle: result.suggestedTitle
      };

    } catch (parseError) {
      logger.error('处理Deepseek响应失败:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      // 返回降级结果而不是抛出异常
      return {
        category: '未分类',
        confidence: 0.3,
        reasoning: `AI分类失败: ${errorMessage}`,
        suggestedTitle: undefined
      };
    }
  } catch (error) {
    logger.error('Deepseek分类失败:', error);
    throw error;
  }
}

/**
 * 获取现有的书签文件夹列表
 */
export async function getExistingFolders(): Promise<string[]> {
  const bookmarkTree = await chrome.bookmarks.getTree();
  const folders: string[] = [];
  
  function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
    for (const node of nodes) {
      if (!node.url && node.title && node.id !== '0') {
        // 排除根节点和系统文件夹
        if (!['书签栏', '其他书签', '移动设备书签'].includes(node.title)) {
          folders.push(node.title);
        }
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }
  
  traverse(bookmarkTree);
  return [...new Set(folders)]; // 去重
}

/**
 * 使用AI对书签进行分类（带智能优化）
 */
export async function classifyBookmark(
  bookmarkInfo: BookmarkInfo,
  apiSettings: {
    provider: 'openai' | 'gemini';
    apiKey: string;
    model: string;
    linkPreviewKey?: string;
    linkPreviewKeys?: string[];
  },
  options: {
    forceReclassify?: boolean;
  } = {}
): Promise<ClassificationResult> {
  logger.debug('开始智能分类:', bookmarkInfo.url);

  // 1. 检查本地域名字典
  const domainPattern = getDomainPattern(bookmarkInfo.url);
  if (domainPattern) {
    logger.debug('使用域名字典分类:', domainPattern.category);
    
    // 缓存字典结果
    await classificationCache.setCachedClassification(
      bookmarkInfo.url,
      domainPattern.category,
      domainPattern.confidence || 0.95,
      'dictionary'
    );
    
    // 对于域名字典匹配，也尝试优化标题
    let suggestedTitle = bookmarkInfo.title;
    // 简单的标题优化规则
    suggestedTitle = suggestedTitle
      .replace(/^\(\d+\)\s*/, '') // 去除开头的 (数字)
      .replace(/【.*?】/g, '') // 去除【】中的内容
      .replace(/\[.*?\]/g, '') // 去除[]中的内容
      .replace(/「|」|"|"|'|'/g, '') // 去除引号
      .replace(/\s*[-–—|]\s*YouTube\s*$/i, '') // 去除 YouTube 后缀
      .replace(/\s*[-–—|]\s*[^-–—|]+\s*$/i, '') // 去除最后的网站名
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim();
    
    // 特殊处理：如果标题太短或太通用，从域名提取品牌名
    const genericTitles = ['explore', 'home', 'dashboard', 'feed', 'main', 'index', 'welcome', '首页', '主页', '探索', '发现'];
    if (suggestedTitle.length < 3 || genericTitles.includes(suggestedTitle.toLowerCase())) {
      try {
        const hostname = new URL(bookmarkInfo.url).hostname;
        const brandName = hostname
          .replace(/^www\./, '')
          .replace(/\.(com|cn|org|net|io|app|dev|ai).*$/, '')
          .split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
        
        if (genericTitles.includes(suggestedTitle.toLowerCase())) {
          // 如果是通用标题，添加品牌前缀
          const titleMap: Record<string, string> = {
            'explore': '探索',
            'home': '首页',
            'dashboard': '控制台',
            'feed': '动态',
            'main': '主页',
            'index': '首页',
            'welcome': '欢迎页'
          };
          const chineseTitle = titleMap[suggestedTitle.toLowerCase()] || suggestedTitle;
          suggestedTitle = `${brandName}${chineseTitle}`;
        } else {
          // 标题太短，使用原标题
          suggestedTitle = bookmarkInfo.title;
        }
      } catch (e) {
        // URL 解析失败，保留原标题
        suggestedTitle = bookmarkInfo.title;
      }
    }
    
    // 限制长度
    if (suggestedTitle.length > 30) {
      suggestedTitle = suggestedTitle.substring(0, 27) + '...';
    }
    
    return {
      category: domainPattern.category,
      confidence: domainPattern.confidence || 0.95,
      reasoning: `基于域名模式识别（${new URL(bookmarkInfo.url).hostname}）`,
      suggestedTitle: suggestedTitle !== bookmarkInfo.title ? suggestedTitle : undefined
    };
  }
  
  // 2. 检查域名分类缓存（除非强制重新分类）
  if (!options.forceReclassify) {
    const cachedClassification = classificationCache.getCachedClassification(bookmarkInfo.url);
    if (cachedClassification) {
      logger.debug('使用缓存分类:', cachedClassification.category);
      return {
        category: cachedClassification.category,
        confidence: cachedClassification.confidence,
        reasoning: '基于同域名历史分类'
      };
    }
  } else {
    logger.debug('强制重新分类，跳过缓存');
    // 清除该域名的缓存
    classificationCache.clearDomainCache(bookmarkInfo.url);
  }
  
  // 3. 尝试获取页面描述（优先使用自托管服务，失败后使用 LinkPreview API）
  if (!bookmarkInfo.description) {
    // 首先尝试使用自托管的 description-scraper 服务
    try {
      // 创建超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(
        `https://description-scraper.onrender.com/description?url=${encodeURIComponent(bookmarkInfo.url)}`,
        { 
          method: 'GET',
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data.description) {
          logger.debug('使用自托管服务获取的描述:', data.description);
          bookmarkInfo.description = data.description;
        }
      } else {
        logger.debug('自托管服务返回错误:', response.status);
      }
    } catch (error) {
      logger.debug('自托管服务请求失败，尝试使用 LinkPreview API:', error);
    }
  }

  // 如果自托管服务失败或没有获取到描述，尝试 LinkPreview API
  if (!bookmarkInfo.description) {
    if (apiSettings.linkPreviewKeys && apiSettings.linkPreviewKeys.length > 0) {
      linkPreviewService.setApiKeys(apiSettings.linkPreviewKeys);

      if (linkPreviewService.hasQuota()) {
        const preview = await linkPreviewService.fetchPreview(bookmarkInfo.url);
        if (preview) {
          logger.debug('使用LinkPreview获取的元数据:', preview.description);
          bookmarkInfo.description = preview.description;
          bookmarkInfo.title = preview.title || bookmarkInfo.title;
        }
      } else {
        const quotaInfo = linkPreviewService.getQuotaInfo();
        logger.info(`LinkPreview配额已用完（${quotaInfo.keyCount}个密钥），${quotaInfo.resetIn}分钟后重置`);
      }
    } else if (apiSettings.linkPreviewKey) {
      // 向后兼容单个密钥
      linkPreviewService.setApiKey(apiSettings.linkPreviewKey);

      if (linkPreviewService.hasQuota()) {
        const preview = await linkPreviewService.fetchPreview(bookmarkInfo.url);
        if (preview) {
          logger.debug('使用LinkPreview获取的元数据:', preview.description);
          bookmarkInfo.description = preview.description;
          bookmarkInfo.title = preview.title || bookmarkInfo.title;
        }
      } else {
        const quotaInfo = linkPreviewService.getQuotaInfo();
        logger.info(`LinkPreview配额已用完，${quotaInfo.resetIn}分钟后重置`);
      }
    }
  }

  // 4. 使用 AI 进行分类
  logger.debug('使用AI进行分类');
  const existingFolders = await getExistingFolders();
  
  let result: ClassificationResult;
  if (apiSettings.provider === 'openai') {
    result = await classifyWithOpenAI(bookmarkInfo, existingFolders, apiSettings.apiKey, apiSettings.model);
  } else if (apiSettings.provider === 'gemini') {
    result = await classifyWithGemini(bookmarkInfo, existingFolders, apiSettings.apiKey, apiSettings.model);
  } else if (apiSettings.provider === 'deepseek') {
    result = await classifyWithDeepseek(bookmarkInfo, existingFolders, apiSettings.apiKey, apiSettings.model);
  } else {
    throw new Error('不支持的AI提供商');
  }
  
  // 5. 缓存AI分类结果
  await classificationCache.setCachedClassification(
    bookmarkInfo.url,
    result.category,
    result.confidence,
    'ai'
  );
  
  return result;
}