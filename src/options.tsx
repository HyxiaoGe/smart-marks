import React, { useState, useEffect } from 'react';

interface FilterSettings {
  excludeFolders: string[];
  excludePatterns: string[];
  autoFilter: boolean;
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
    autoFilter: true
  });

  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // 加载设置和书签文件夹
  useEffect(() => {
    loadSettings();
    loadBookmarkFolders();
  }, []);

  // 加载保存的设置
  const loadSettings = async () => {
    try {
      const result = await chrome.storage.sync.get(['filterSettings']);
      if (result.filterSettings) {
        setFilterSettings(result.filterSettings);
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

  // 保存设置
  const saveSettings = async () => {
    setSaving(true);
    setSyncStatus('syncing');
    
    try {
      await chrome.storage.sync.set({ filterSettings });
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
      // 将通配符模式转换为正则表达式
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\//g, '\\/');
      
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(folderPath);
    });
  };

  // 检查文件夹是否被排除（包括直接勾选和自定义规则匹配）
  const isFolderExcluded = (folderPath: string): boolean => {
    return filterSettings.excludeFolders.includes(folderPath) || isMatchedByPattern(folderPath);
  };

  // 添加常用隐私文件夹
  const addCommonPrivacyFolders = () => {
    const commonFolders = ['隐私', '私人', '个人', '工作', '机密', '临时'];
    setFilterSettings(prev => ({
      ...prev,
      excludeFolders: [...new Set([...prev.excludeFolders, ...commonFolders])]
    }));
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

            <div style={{ marginBottom: '15px' }}>
              <button
                onClick={addCommonPrivacyFolders}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginRight: '10px'
                }}
              >
                添加常用隐私文件夹
              </button>
              
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