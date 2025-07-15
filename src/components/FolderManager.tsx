import React, { useState, useEffect } from 'react';
import { getMergeSuggestion, normalizeFolder, STANDARD_FOLDERS } from '../services/folder-normalizer';

interface FolderInfo {
  id: string;
  title: string;
  bookmarkCount: number;
  suggestedMerge?: string;
}

/**
 * 文件夹管理组件
 */
export function FolderManager() {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);

  useEffect(() => {
    loadFolderInfo();
  }, []);

  const loadFolderInfo = async () => {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const folderMap = new Map<string, FolderInfo>();
      
      // 收集所有文件夹信息
      function traverse(nodes: chrome.bookmarks.BookmarkTreeNode[]) {
        for (const node of nodes) {
          if (!node.url && node.title && node.id !== '0') {
            // 排除系统文件夹
            if (!['书签栏', '其他书签', '移动设备书签', 'Bookmarks Bar', 'Other Bookmarks'].includes(node.title)) {
              const bookmarkCount = countBookmarks(node);
              folderMap.set(node.id, {
                id: node.id,
                title: node.title,
                bookmarkCount
              });
            }
          }
          if (node.children) {
            traverse(node.children);
          }
        }
      }
      
      // 计算文件夹中的书签数量
      function countBookmarks(folder: chrome.bookmarks.BookmarkTreeNode): number {
        let count = 0;
        if (folder.children) {
          for (const child of folder.children) {
            if (child.url) {
              count++;
            } else if (child.children) {
              count += countBookmarks(child);
            }
          }
        }
        return count;
      }
      
      traverse(bookmarkTree);
      
      // 获取合并建议
      const folderList = Array.from(folderMap.values());
      const suggestions = getMergeSuggestion(folderList.map(f => f.title));
      
      // 添加建议到文件夹信息
      folderList.forEach(folder => {
        const suggestion = suggestions.get(folder.title);
        if (suggestion && suggestion !== folder.title) {
          folder.suggestedMerge = suggestion;
        }
      });
      
      setFolders(folderList.sort((a, b) => b.bookmarkCount - a.bookmarkCount));
    } catch (error) {
      console.error('加载文件夹信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const mergeFolder = async (folderId: string, targetFolderName: string) => {
    setMerging(folderId);
    
    try {
      // 查找或创建目标文件夹
      const targetFolder = await findOrCreateFolder(targetFolderName);
      if (!targetFolder) {
        throw new Error('无法创建目标文件夹');
      }
      
      // 获取源文件夹的所有书签
      const bookmarks = await chrome.bookmarks.getChildren(folderId);
      
      // 移动所有书签到目标文件夹
      for (const bookmark of bookmarks) {
        await chrome.bookmarks.move(bookmark.id, {
          parentId: targetFolder.id
        });
      }
      
      // 删除空文件夹
      await chrome.bookmarks.remove(folderId);
      
      // 重新加载文件夹列表
      await loadFolderInfo();
      
      alert(`已成功将书签合并到"${targetFolderName}"文件夹`);
    } catch (error) {
      console.error('合并文件夹失败:', error);
      alert('合并失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setMerging(null);
    }
  };

  const findOrCreateFolder = async (folderName: string): Promise<chrome.bookmarks.BookmarkTreeNode | null> => {
    const bookmarkTree = await chrome.bookmarks.getTree();
    
    // 查找书签栏
    let bookmarkBarNode = bookmarkTree[0].children?.find(node => node.id === '1');
    if (!bookmarkBarNode) {
      return null;
    }
    
    // 查找或创建智能分类文件夹
    let smartFolder = bookmarkBarNode.children?.find(node => node.title === '智能分类');
    if (!smartFolder) {
      smartFolder = await chrome.bookmarks.create({
        parentId: bookmarkBarNode.id,
        title: '智能分类'
      });
    }
    
    // 查找目标文件夹
    let targetFolder = smartFolder.children?.find(node => node.title === folderName);
    if (!targetFolder) {
      targetFolder = await chrome.bookmarks.create({
        parentId: smartFolder.id,
        title: folderName
      });
    }
    
    return targetFolder;
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div style={{ marginTop: '20px' }}>
      <h3 style={{ marginBottom: '15px' }}>📁 文件夹管理</h3>
      
      {folders.filter(f => f.suggestedMerge).length > 0 && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '4px',
          padding: '10px',
          marginBottom: '15px'
        }}>
          <strong>💡 建议：</strong>发现 {folders.filter(f => f.suggestedMerge).length} 个文件夹可以合并到标准文件夹
        </div>
      )}
      
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '8px', textAlign: 'left' }}>文件夹名称</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>书签数量</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {folders.map(folder => (
              <tr key={folder.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>
                  {folder.title}
                  {folder.suggestedMerge && (
                    <span style={{ 
                      marginLeft: '8px', 
                      fontSize: '12px', 
                      color: '#666' 
                    }}>
                      → {folder.suggestedMerge}
                    </span>
                  )}
                </td>
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  {folder.bookmarkCount}
                </td>
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  {folder.suggestedMerge && (
                    <button
                      onClick={() => mergeFolder(folder.id, folder.suggestedMerge!)}
                      disabled={merging === folder.id}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        backgroundColor: merging === folder.id ? '#ccc' : '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: merging === folder.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {merging === folder.id ? '合并中...' : '合并'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h4>推荐的标准文件夹：</h4>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '8px',
          marginTop: '10px'
        }}>
          {STANDARD_FOLDERS.map(folder => (
            <span
              key={folder}
              style={{
                padding: '4px 8px',
                backgroundColor: '#e0e0e0',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              {folder}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}