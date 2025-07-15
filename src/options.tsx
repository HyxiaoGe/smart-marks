import React, { useState, useEffect } from 'react';

interface FilterSettings {
  excludeFolders: string[];
  excludePatterns: string[];
  autoFilter: boolean;
  ignoreCase: boolean;
}

interface APISettings {
  provider: 'openai' | 'gemini' | '';
  apiKey: string;
  model: string;
  autoClassify: boolean;
}

interface BookmarkFolder {
  id: string;
  title: string;
  parentId?: string;
  children?: BookmarkFolder[];
  path: string;
  level: number;
}

/**
 * 扩展设置页面
 */
function OptionsPage() {
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    excludeFolders: [],
    excludePatterns: [],
    autoFilter: true,
    ignoreCase: true
  });

  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  const [apiSettings, setApiSettings] = useState<APISettings>({
    provider: '',
    apiKey: '',
    model: '',
    autoClassify: true
  });
  
  const [testingAPI, setTestingAPI] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // 加载设置和书签文件夹
  useEffect(() => {
    loadSettings();
    loadBookmarkFolders();
  }, []);

  // 加载保存的设置
  const loadSettings = async () => {
    try {
      const result = await chrome.storage.sync.get(['filterSettings', 'apiSettings']);
      console.log('加载的设置:', result);
      
      if (result.filterSettings) {
        setFilterSettings(result.filterSettings);
      }
      if (result.apiSettings) {
        setApiSettings(result.apiSettings);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  };

  // 加载书签文件夹结构
  const loadBookmarkFolders = async () => {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const folders = extractFolders(bookmarkTree);
      setBookmarkFolders(folders);
    } catch (error) {
      console.error('加载书签文件夹失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 保存按钮时清除测试结果
  useEffect(() => {
    setApiTestResult(null);
  }, [apiSettings.apiKey, apiSettings.provider]);
  
  // 自动保存API设置（使用防抖）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (apiSettings.provider || apiSettings.apiKey) {
        console.log('自动保存API设置...');
        chrome.storage.sync.set({ apiSettings }).then(() => {
          console.log('API设置已自动保存');
        }).catch(error => {
          console.error('自动保存失败:', error);
        });
      }
    }, 1000); // 1秒后自动保存
    
    return () => clearTimeout(timer);
  }, [apiSettings]);

  // 从书签树中提取文件夹
  const extractFolders = (nodes: chrome.bookmarks.BookmarkTreeNode[], parentPath = '', level = 0): BookmarkFolder[] => {
    const folders: BookmarkFolder[] = [];
    
    for (const node of nodes) {
      if (!node.url) { // 是文件夹
        const currentPath = parentPath ? `${parentPath}/${node.title}` : node.title;
        const folder: BookmarkFolder = {
          id: node.id,
          title: node.title,
          parentId: node.parentId,
          path: currentPath,
          level: level
        };
        
        folders.push(folder);
        
        // 递归处理子文件夹
        if (node.children) {
          const childFolders = extractFolders(node.children, currentPath, level + 1);
          folders.push(...childFolders);
        }
      }
    }
    
    return folders;
  };

  // 测试API连接
  const testAPIConnection = async () => {
    console.log('开始测试API连接，当前设置:', apiSettings);
    
    if (!apiSettings.apiKey || !apiSettings.provider) {
      console.log('API密钥或提供商未设置');
      alert('请先选择AI服务提供商并输入API密钥');
      return;
    }

    setTestingAPI(true);
    setApiTestResult(null);

    try {
      console.log('发送测试请求到background script...');
      
      // 发送消息给background script测试API
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_API',
        apiSettings: {
          provider: apiSettings.provider,
          apiKey: apiSettings.apiKey,
          model: apiSettings.model
        }
      });

      console.log('收到响应:', response);

      if (response && response.success) {
        setApiTestResult({
          success: true,
          message: 'API连接成功！可以正常使用AI分类功能。'
        });
      } else {
        setApiTestResult({
          success: false,
          message: response?.error || 'API连接失败，请检查密钥是否正确。'
        });
      }
    } catch (error) {
      console.error('测试API失败:', error);
      setApiTestResult({
        success: false,
        message: '测试失败：' + (error instanceof Error ? error.message : '未知错误')
      });
    } finally {
      setTestingAPI(false);
    }
  };

  // 保存设置
  const saveSettings = async () => {
    setSaving(true);
    setSyncStatus('syncing');
    
    try {
      console.log('保存设置:', { filterSettings, apiSettings });
      
      await chrome.storage.sync.set({ 
        filterSettings,
        apiSettings 
      });
      setSyncStatus('success');
      setLastSyncTime(new Date());
      
      // 显示保存成功提示
      const saveButton = document.getElementById('saveButton');
      if (saveButton) {
        saveButton.textContent = '✓ 已保存';
        saveButton.style.backgroundColor = '#4CAF50';
        setTimeout(() => {
          saveButton.textContent = '保存设置';
          saveButton.style.backgroundColor = '#2196F3';
        }, 2000);
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      setSyncStatus('error');
      alert('保存设置失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 切换文件夹排除状态（支持级联选择和自定义规则处理）
  const toggleFolderExclusion = (folderPath: string) => {
    setFilterSettings(prev => {
      const isInExcludeFolders = prev.excludeFolders.includes(folderPath);
      const isMatchedByPatterns = isMatchedByPattern(folderPath);
      let newExcludeFolders = [...prev.excludeFolders];
      
      if (isInExcludeFolders) {
        // 如果文件夹在excludeFolders中，移除它和所有子文件夹
        newExcludeFolders = newExcludeFolders.filter(path => 
          path !== folderPath && !path.startsWith(folderPath + '/')
        );
      } else {
        // 如果文件夹不在excludeFolders中，添加它
        newExcludeFolders.push(folderPath);
        
        // 自动添加所有子文件夹（除非它们已经被自定义规则匹配）
        const childFolders = bookmarkFolders
          .filter(folder => folder.path.startsWith(folderPath + '/'))
          .filter(folder => !isMatchedByPattern(folder.path)) // 避免重复添加被规则匹配的文件夹
          .map(folder => folder.path);
        
        newExcludeFolders = [...new Set([...newExcludeFolders, ...childFolders])];
      }
      
      return {
        ...prev,
        excludeFolders: newExcludeFolders
      };
    });
  };

  // 添加自定义排除模式
  const addExcludePattern = () => {
    const examples = [
      '*私人*     - 匹配包含"私人"的所有文件夹',
      '*temp*     - 匹配包含"temp"的所有文件夹',
      '工作/*     - 匹配"工作"文件夹下的所有子文件夹',
      'Private    - 精确匹配名为"Private"的文件夹'
    ];
    
    const pattern = prompt(`请输入要排除的文件夹名称或模式（支持通配符*）:

示例：
${examples.join('\n')}

输入你的规则:`);
    
    if (pattern && pattern.trim()) {
      const trimmedPattern = pattern.trim();
      setFilterSettings(prev => ({
        ...prev,
        excludePatterns: [...prev.excludePatterns, trimmedPattern]
      }));
    }
  };

  // 删除排除模式
  const removeExcludePattern = (index: number) => {
    setFilterSettings(prev => ({
      ...prev,
      excludePatterns: prev.excludePatterns.filter((_, i) => i !== index)
    }));
  };

  // 检查文件夹路径是否匹配自定义规则
  const isMatchedByPattern = (folderPath: string): boolean => {
    return filterSettings.excludePatterns.some(pattern => {
      // 如果模式不包含通配符，进行精确匹配
      if (!pattern.includes('*') && !pattern.includes('?')) {
        // 精确匹配：完整路径匹配或文件夹名称匹配
        if (filterSettings.ignoreCase) {
          const lowerPath = folderPath.toLowerCase();
          const lowerPattern = pattern.toLowerCase();
          return lowerPath === lowerPattern || 
                 lowerPath.endsWith('/' + lowerPattern) ||
                 lowerPath.split('/').includes(lowerPattern);
        } else {
          return folderPath === pattern || 
                 folderPath.endsWith('/' + pattern) ||
                 folderPath.split('/').includes(pattern);
        }
      }
      
      // 处理 "folder/*" 模式（匹配folder下的所有子文件夹）
      if (pattern.endsWith('/*')) {
        const parentFolder = pattern.slice(0, -2); // 移除 /*
        if (filterSettings.ignoreCase) {
          const lowerPath = folderPath.toLowerCase();
          const lowerParent = parentFolder.toLowerCase();
          return lowerPath.startsWith(lowerParent + '/') || 
                 lowerPath.includes('/' + lowerParent + '/');
        } else {
          return folderPath.startsWith(parentFolder + '/') || 
                 folderPath.includes('/' + parentFolder + '/');
        }
      }
      
      // 将通配符模式转换为正则表达式
      let regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      
      // 如果模式以 * 开头或结尾，允许部分匹配
      if (pattern.startsWith('*') || pattern.endsWith('*')) {
        const regex = new RegExp(regexPattern, filterSettings.ignoreCase ? 'i' : '');
        return regex.test(folderPath);
      } else {
        // 否则进行完整路径匹配
        const regex = new RegExp(`^${regexPattern}$`, filterSettings.ignoreCase ? 'i' : '');
        return regex.test(folderPath);
      }
    });
  };

  // 检查文件夹是否被排除（包括直接勾选和自定义规则匹配）
  const isFolderExcluded = (folderPath: string): boolean => {
    return filterSettings.excludeFolders.includes(folderPath) || isMatchedByPattern(folderPath);
  };


  // 清空所有勾选的文件夹
  const clearAllSelections = () => {
    if (window.confirm('确定要清空所有勾选的文件夹吗？这将清除所有手动勾选的文件夹，但不会删除自定义规则。')) {
      setFilterSettings(prev => ({
        ...prev,
        excludeFolders: []
      }));
    }
  };

  // 清空所有设置（包括自定义规则）
  const clearAllSettings = () => {
    if (window.confirm('确定要清空所有设置吗？这将清除所有勾选的文件夹和自定义规则。')) {
      setFilterSettings(prev => ({
        ...prev,
        excludeFolders: [],
        excludePatterns: []
      }));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>正在加载设置...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif' 
    }}>
      <h1 style={{ color: '#333', marginBottom: '30px' }}>
        🔖 Smart Marks 设置
      </h1>

      {/* AI设置 */}
      <div style={{ 
        backgroundColor: '#f3f4f6', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px' 
      }}>
        <h2 style={{ color: '#333', marginBottom: '15px' }}>
          🤖 AI智能分类设置
        </h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <input
              type="checkbox"
              checked={apiSettings.autoClassify}
              onChange={(e) => setApiSettings(prev => ({ 
                ...prev, 
                autoClassify: e.target.checked 
              }))}
            />
            <span>启用AI自动分类（新书签自动整理到合适的文件夹）</span>
          </label>
        </div>

        {apiSettings.autoClassify && (
          <>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                AI服务提供商
              </label>
              <select
                value={apiSettings.provider}
                onChange={(e) => {
                  const provider = e.target.value as 'openai' | 'gemini' | '';
                  setApiSettings(prev => ({ 
                    ...prev, 
                    provider,
                    model: provider === 'openai' ? 'gpt-4o-mini' : provider === 'gemini' ? 'gemini-1.5-flash' : ''
                  }));
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                <option value="">请选择AI服务</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>

            {apiSettings.provider && (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                    API密钥
                  </label>
                  <input
                    type="password"
                    value={apiSettings.apiKey}
                    onChange={(e) => setApiSettings(prev => ({ 
                      ...prev, 
                      apiKey: e.target.value 
                    }))}
                    placeholder={`请输入${apiSettings.provider === 'openai' ? 'OpenAI' : 'Google'} API密钥`}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '14px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                  <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
                    {apiSettings.provider === 'openai' ? (
                      <span>获取API密钥：<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI控制台</a></span>
                    ) : (
                      <span>获取API密钥：<a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></span>
                    )}
                    {apiSettings.apiKey && (
                      <span style={{ marginLeft: '10px', color: '#4CAF50' }}>
                        （已输入 {apiSettings.apiKey.length} 个字符）
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>
                    模型选择
                  </label>
                  <select
                    value={apiSettings.model}
                    onChange={(e) => setApiSettings(prev => ({ 
                      ...prev, 
                      model: e.target.value 
                    }))}
                    style={{
                      width: '100%',
                      padding: '8px',
                      fontSize: '14px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  >
                    {apiSettings.provider === 'openai' ? (
                      <>
                        <option value="gpt-4o-mini">GPT-4o-mini (推荐，成本低)</option>
                        <option value="gpt-4o">GPT-4o (效果更好，成本高)</option>
                        <option value="gpt-3.5-turbo">GPT-3.5-turbo (经济实惠)</option>
                      </>
                    ) : (
                      <>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (推荐)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro (更强大)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* 测试API连接按钮 */}
                <div style={{ marginBottom: '15px' }}>
                  <button
                    onClick={testAPIConnection}
                    disabled={!apiSettings.apiKey || testingAPI}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: testingAPI ? '#ccc' : '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: testingAPI || !apiSettings.apiKey ? 'not-allowed' : 'pointer',
                      opacity: !apiSettings.apiKey ? 0.6 : 1
                    }}
                  >
                    {testingAPI ? '测试中...' : '测试API连接'}
                  </button>
                  {apiTestResult && (
                    <div style={{ 
                      marginTop: '10px', 
                      padding: '10px', 
                      borderRadius: '4px',
                      backgroundColor: apiTestResult.success ? '#e8f5e9' : '#ffebee',
                      color: apiTestResult.success ? '#2e7d32' : '#c62828',
                      fontSize: '14px'
                    }}>
                      {apiTestResult.success ? '✓' : '✗'} {apiTestResult.message}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* 文件夹过滤设置 */}
      <div style={{ 
        backgroundColor: '#f9f9f9', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px' 
      }}>
        <h2 style={{ color: '#333', marginBottom: '15px' }}>
          🔒 隐私保护设置
        </h2>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={filterSettings.autoFilter}
              onChange={(e) => setFilterSettings(prev => ({ 
                ...prev, 
                autoFilter: e.target.checked 
              }))}
            />
            <span>启用文件夹过滤（保护隐私文件夹不被AI处理）</span>
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={filterSettings.ignoreCase}
              onChange={(e) => setFilterSettings(prev => ({ 
                ...prev, 
                ignoreCase: e.target.checked 
              }))}
            />
            <span>忽略大小写（匹配规则时不区分大小写）</span>
          </label>
        </div>

        {filterSettings.autoFilter && (
          <>
            <h3 style={{ color: '#555', marginBottom: '10px' }}>选择要排除的文件夹：</h3>
            
            <div style={{ 
              maxHeight: '300px', 
              overflowY: 'auto', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              padding: '10px',
              backgroundColor: 'white',
              marginBottom: '15px'
            }}>
              {bookmarkFolders.map((folder) => (
                <div 
                  key={folder.id}
                  style={{ 
                    marginLeft: `${folder.level * 20}px`,
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isFolderExcluded(folder.path)}
                    onChange={() => toggleFolderExclusion(folder.path)}
                    disabled={isMatchedByPattern(folder.path) && !filterSettings.excludeFolders.includes(folder.path)}
                    title={isMatchedByPattern(folder.path) && !filterSettings.excludeFolders.includes(folder.path) 
                      ? "此文件夹被自定义规则匹配，请删除对应规则来取消勾选" 
                      : ""}
                  />
                  <span style={{ 
                    fontSize: '14px',
                    color: isFolderExcluded(folder.path) ? '#f44336' : '#333'
                  }}>
                    {folder.title}
                    {isMatchedByPattern(folder.path) && !filterSettings.excludeFolders.includes(folder.path) && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#FF9800', 
                        marginLeft: '5px' 
                      }}>
                        (规则匹配)
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    ({folder.path})
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '15px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button
                onClick={addExcludePattern}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#9C27B0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                添加自定义规则
              </button>

              <button
                onClick={clearAllSelections}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                清空勾选
              </button>

              <button
                onClick={clearAllSettings}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#9e9e9e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                清空所有设置
              </button>
            </div>

            {/* 显示已排除的模式 */}
            {filterSettings.excludePatterns.length > 0 && (
              <div>
                <h4 style={{ color: '#555', marginBottom: '10px' }}>自定义排除规则：</h4>
                {filterSettings.excludePatterns.map((pattern, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    marginBottom: '5px'
                  }}>
                    <span style={{ 
                      backgroundColor: '#f44336', 
                      color: 'white', 
                      padding: '2px 8px', 
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      {pattern}
                    </span>
                    <button
                      onClick={() => removeExcludePattern(index)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f44336',
                        cursor: 'pointer',
                        fontSize: '16px'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 保存按钮 */}
      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <button
          id="saveButton"
          onClick={saveSettings}
          disabled={saving}
          style={{
            padding: '12px 24px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1
          }}
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
        
        {/* 同步状态显示 */}
        <div style={{ marginTop: '10px', fontSize: '14px' }}>
          {syncStatus === 'syncing' && (
            <span style={{ color: '#FF9800' }}>⏳ 正在同步到Chrome账户...</span>
          )}
          {syncStatus === 'success' && lastSyncTime && (
            <span style={{ color: '#4CAF50' }}>
              ✓ 已同步到Chrome账户 ({lastSyncTime.toLocaleTimeString()})
            </span>
          )}
          {syncStatus === 'error' && (
            <span style={{ color: '#f44336' }}>✗ 同步失败，请重试</span>
          )}
        </div>
      </div>

      {/* 使用说明 */}
      <div style={{ 
        marginTop: '30px', 
        padding: '15px', 
        backgroundColor: '#e3f2fd', 
        borderRadius: '8px' 
      }}>
        <h3 style={{ color: '#1976d2', marginBottom: '10px' }}>📝 使用说明</h3>
        <ul style={{ marginLeft: '20px', lineHeight: '1.6' }}>
          <li><strong>级联选择</strong>：勾选父文件夹会自动勾选所有子文件夹</li>
          <li><strong>自定义规则</strong>：
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>支持通配符模式，如 *oauth* 匹配包含"oauth"的所有文件夹</li>
              <li>添加规则后，匹配的文件夹会立即显示为已勾选状态</li>
              <li>规则匹配的文件夹会显示 <span style={{color: '#FF9800'}}>(规则匹配)</span> 标签</li>
            </ul>
          </li>
          <li><strong>常用示例</strong>：
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>*temp* - 匹配所有包含"temp"的文件夹</li>
              <li>*oauth* - 匹配所有包含"oauth"的文件夹</li>
              <li>工作/* - 匹配"工作"文件夹下的所有子文件夹</li>
              <li>Private - 精确匹配名为"Private"的文件夹</li>
            </ul>
          </li>
          <li><strong>实时效果</strong>：文件夹列表会实时显示哪些文件夹被规则匹配</li>
          <li><strong>同步状态</strong>：设置会自动同步到Chrome账户，可查看同步状态</li>
          <li><strong>隐私保护</strong>：被排除的文件夹中的书签不会被AI处理</li>
        </ul>
      </div>
    </div>
  );
}

export default OptionsPage;