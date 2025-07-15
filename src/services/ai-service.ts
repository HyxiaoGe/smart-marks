/**
 * AI服务模块 - 处理与AI API的交互
 */

import { getDomainPattern } from './domain-patterns';
import { classificationCache } from './classification-cache';
import { linkPreviewService } from './linkpreview-service';

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
  const systemPrompt = `你是一个智能书签分类助手。你的任务是根据书签的标题、URL和描述，将其分类到最合适的文件夹中。

现有的文件夹列表：
${existingFolders.map(f => `- ${f}`).join('\n')}

分类规则：
1. 优先选择现有文件夹
2. 如果现有文件夹都不合适，可以建议一个新的文件夹名称
3. 文件夹名称应该简洁明了，使用中文
4. 考虑书签的主要用途和内容类型

请以JSON格式返回分类结果，格式如下：
{
  "category": "文件夹名称",
  "confidence": 0.8,
  "reasoning": "分类理由"
}`;

  const userPrompt = `请对以下书签进行分类：
标题：${bookmarkInfo.title}
URL：${bookmarkInfo.url}
${bookmarkInfo.description ? `描述：${bookmarkInfo.description}` : ''}
${bookmarkInfo.keywords?.length ? `关键词：${bookmarkInfo.keywords.join(', ')}` : ''}`;

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
      console.error('OpenAI API错误响应:', errorData);
      throw new Error(`OpenAI API错误: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    return {
      category: result.category || '未分类',
      confidence: result.confidence || 0.5,
      reasoning: result.reasoning
    };
  } catch (error) {
    console.error('OpenAI分类失败:', error);
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
  const prompt = `作为一个智能书签分类助手，请根据以下书签信息进行分类。

现有文件夹：
${existingFolders.map(f => `- ${f}`).join('\n')}

书签信息：
- 标题：${bookmarkInfo.title}
- URL：${bookmarkInfo.url}
${bookmarkInfo.description ? `- 描述：${bookmarkInfo.description}` : ''}
${bookmarkInfo.keywords?.length ? `- 关键词：${bookmarkInfo.keywords.join(', ')}` : ''}

请优先选择现有文件夹，如果都不合适，可以建议新的文件夹名称。
返回JSON格式：{"category": "文件夹名称", "confidence": 0.8, "reasoning": "分类理由"}`;

  try {
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
      console.error('Gemini API错误响应:', errorData);
      throw new Error(`Gemini API错误: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    
    // 提取JSON内容
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      throw new Error('无法解析Gemini返回的结果');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    return {
      category: result.category || '未分类',
      confidence: result.confidence || 0.5,
      reasoning: result.reasoning
    };
  } catch (error) {
    console.error('Gemini分类失败:', error);
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
  }
): Promise<ClassificationResult> {
  console.log('开始智能分类:', bookmarkInfo.url);
  
  // 1. 检查本地域名字典
  const domainPattern = getDomainPattern(bookmarkInfo.url);
  if (domainPattern) {
    console.log('使用域名字典分类:', domainPattern.category);
    
    // 缓存字典结果
    await classificationCache.setCachedClassification(
      bookmarkInfo.url,
      domainPattern.category,
      domainPattern.confidence || 0.95,
      'dictionary'
    );
    
    return {
      category: domainPattern.category,
      confidence: domainPattern.confidence || 0.95,
      reasoning: `基于域名模式识别（${new URL(bookmarkInfo.url).hostname}）`
    };
  }
  
  // 2. 检查域名分类缓存
  const cachedClassification = classificationCache.getCachedClassification(bookmarkInfo.url);
  if (cachedClassification) {
    console.log('使用缓存分类:', cachedClassification.category);
    return {
      category: cachedClassification.category,
      confidence: cachedClassification.confidence,
      reasoning: '基于同域名历史分类'
    };
  }
  
  // 3. 尝试使用 LinkPreview API 获取元数据（如果配置了）
  if (apiSettings.linkPreviewKey && !bookmarkInfo.description) {
    linkPreviewService.setApiKey(apiSettings.linkPreviewKey);
    
    if (linkPreviewService.hasQuota()) {
      const preview = await linkPreviewService.fetchPreview(bookmarkInfo.url);
      if (preview) {
        console.log('使用LinkPreview获取的元数据:', preview.description);
        bookmarkInfo.description = preview.description;
        bookmarkInfo.title = preview.title || bookmarkInfo.title;
      }
    } else {
      const quotaInfo = linkPreviewService.getQuotaInfo();
      console.log(`LinkPreview配额已用完，${quotaInfo.resetIn}分钟后重置`);
    }
  }
  
  // 4. 使用 AI 进行分类
  console.log('使用AI进行分类');
  const existingFolders = await getExistingFolders();
  
  let result: ClassificationResult;
  if (apiSettings.provider === 'openai') {
    result = await classifyWithOpenAI(bookmarkInfo, existingFolders, apiSettings.apiKey, apiSettings.model);
  } else if (apiSettings.provider === 'gemini') {
    result = await classifyWithGemini(bookmarkInfo, existingFolders, apiSettings.apiKey, apiSettings.model);
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