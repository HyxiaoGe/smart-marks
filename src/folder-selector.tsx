import React, { useState, useEffect } from 'react';

interface BookmarkFolder {
  id: string;
  title: string;
  parentId?: string;
  children?: chrome.bookmarks.BookmarkTreeNode[];
  path: string;
  bookmarkCount?: number;
}

/**
 * 文件夹选择器 - 用于选择要整理的单个文件夹
 */
function FolderSelector() {
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadFolders();
  }, []);

  // 加载文件夹列表
  const loadFolders = async () => {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const folderList = extractFoldersWithCount(bookmarkTree);
      setFolders(folderList.filter(f => f.bookmarkCount && f.bookmarkCount > 0));
    } catch (error) {
      console.error('加载文件夹失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 提取文件夹及其书签数量
  const extractFoldersWithCount = (nodes: chrome.bookmarks.BookmarkTreeNode[], path = ''): BookmarkFolder[] => {
    const result: BookmarkFolder[] = [];
    
    function traverse(node: chrome.bookmarks.BookmarkTreeNode, currentPath: string) {
      if (!node.url) { // 是文件夹
        const folderPath = currentPath ? `${currentPath}/${node.title}` : node.title;
        let bookmarkCount = 0;
        
        // 计算直接子书签数量
        if (node.children) {
          bookmarkCount = node.children.filter(child => child.url).length;
          
          // 递归处理子文件夹
          node.children.forEach(child => {
            if (!child.url) {
              traverse(child, folderPath);
            }
          });
        }
        
        // 排除系统文件夹和智能分类文件夹
        if (node.id !== '0' && 
            !['书签栏', '其他书签', '移动设备书签'].includes(node.title) &&
            !folderPath.includes('智能分类')) {
          result.push({
            id: node.id,
            title: node.title,
            parentId: node.parentId,
            path: folderPath,
            bookmarkCount
          });
        }
      }
    }
    
    nodes.forEach(node => traverse(node, ''));
    return result;
  };

  // 处理文件夹整理
  const handleOrganizeFolder = async () => {
    if (!selectedFolder) {
      alert('请选择要整理的文件夹');
      return;
    }

    setProcessing(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'organizeSingleFolder',
        folderId: selectedFolder
      });

      if (response.success) {
        alert(`文件夹整理完成！\n已处理 ${response.processed} 个书签`);
        window.close();
      } else {
        alert(`整理失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('整理失败:', error);
      alert('整理失败，请重试');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>正在加载文件夹列表...</p>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      <h2 style={{ marginBottom: '20px', color: '#333' }}>
        📁 选择要整理的文件夹
      </h2>

      <div style={{
        backgroundColor: '#fff8e1',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        fontSize: '14px'
      }}>
        <p style={{ margin: '0 0 8px 0' }}>
          <strong>提示：</strong>
        </p>
        <ul style={{ margin: '0', paddingLeft: '20px' }}>
          <li>只会整理选中文件夹中的书签</li>
          <li>书签会被移动到"智能分类"文件夹下的相应分类</li>
          <li>已在"智能分类"中的书签不会重复处理</li>
        </ul>
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        maxHeight: '300px',
        overflowY: 'auto',
        border: '1px solid #ddd'
      }}>
        {folders.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666' }}>
            没有找到包含书签的文件夹
          </p>
        ) : (
          folders.map(folder => (
            <label
              key={folder.id}
              style={{
                display: 'block',
                padding: '10px',
                marginBottom: '8px',
                backgroundColor: selectedFolder === folder.id ? '#e3f2fd' : '#f5f5f5',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              <input
                type="radio"
                name="folder"
                value={folder.id}
                checked={selectedFolder === folder.id}
                onChange={(e) => setSelectedFolder(e.target.value)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontWeight: selectedFolder === folder.id ? 'bold' : 'normal' }}>
                {folder.title}
              </span>
              <span style={{ 
                fontSize: '12px', 
                color: '#666',
                marginLeft: '8px'
              }}>
                ({folder.bookmarkCount} 个书签)
              </span>
              <div style={{ 
                fontSize: '11px', 
                color: '#999',
                marginLeft: '24px',
                marginTop: '4px'
              }}>
                {folder.path}
              </div>
            </label>
          ))
        )}
      </div>

      <div style={{
        marginTop: '20px',
        display: 'flex',
        gap: '10px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={() => window.close()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#9e9e9e',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          取消
        </button>
        <button
          onClick={handleOrganizeFolder}
          disabled={!selectedFolder || processing}
          style={{
            padding: '10px 20px',
            backgroundColor: !selectedFolder || processing ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: !selectedFolder || processing ? 'not-allowed' : 'pointer'
          }}
        >
          {processing ? '整理中...' : '开始整理'}
        </button>
      </div>
    </div>
  );
}

export default FolderSelector;