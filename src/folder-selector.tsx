import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

interface BookmarkFolder {
  id: string;
  title: string;
  path: string;
  bookmarkCount: number;
}

function FolderSelectorPage() {
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const bookmarkTree = await chrome.bookmarks.getTree();
      const folderList: BookmarkFolder[] = [];
      
      // 递归遍历书签树，找出所有文件夹
      function traverseBookmarks(
        nodes: chrome.bookmarks.BookmarkTreeNode[], 
        path: string = ''
      ) {
        for (const node of nodes) {
          if (!node.url && node.children) {
            // 这是一个文件夹
            const currentPath = path ? `${path} > ${node.title}` : node.title;
            
            // 统计文件夹中的书签数量
            let bookmarkCount = 0;
            function countBookmarks(children: chrome.bookmarks.BookmarkTreeNode[]) {
              for (const child of children) {
                if (child.url) {
                  bookmarkCount++;
                } else if (child.children) {
                  countBookmarks(child.children);
                }
              }
            }
            
            countBookmarks(node.children);
            
            // 排除智能分类文件夹和空文件夹
            if (node.title !== '智能分类' && bookmarkCount > 0) {
              folderList.push({
                id: node.id,
                title: node.title,
                path: currentPath,
                bookmarkCount
              });
            }
            
            // 递归处理子文件夹
            traverseBookmarks(node.children, currentPath);
          }
        }
      }
      
      traverseBookmarks(bookmarkTree);
      
      // 按书签数量排序
      folderList.sort((a, b) => b.bookmarkCount - a.bookmarkCount);
      
      setFolders(folderList);
    } catch (error) {
      console.error('加载文件夹失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrganizeFolder = async (folder: BookmarkFolder) => {
    if (!confirm(`确定要整理文件夹 "${folder.title}" 中的 ${folder.bookmarkCount} 个书签吗？`)) {
      return;
    }

    setProcessingId(folder.id);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'organizeSingleFolder',
        folderId: folder.id
      });

      if (response.success) {
        alert(`整理完成！已处理 ${response.processed} 个书签`);
        // 重新加载文件夹列表
        await loadFolders();
      } else {
        alert(`整理失败: ${response.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('整理文件夹失败:', error);
      alert('操作失败，请重试');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px'
    }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>
        📁 选择要整理的文件夹
      </h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <p>加载中...</p>
        </div>
      ) : folders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <p>没有可整理的文件夹</p>
          <button 
            onClick={() => window.close()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            关闭
          </button>
        </div>
      ) : (
        <>
          <div style={{ 
            marginBottom: '20px',
            textAlign: 'center',
            color: '#666'
          }}>
            <p>选择一个文件夹进行智能整理</p>
          </div>

          <div style={{
            display: 'grid',
            gap: '15px'
          }}>
            {folders.map((folder) => (
              <div key={folder.id} style={{
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '15px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>
                    {folder.title}
                  </h3>
                  <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>
                    路径: {folder.path}
                  </p>
                  <p style={{ margin: '0', fontSize: '14px', color: '#2196F3' }}>
                    包含 {folder.bookmarkCount} 个书签
                  </p>
                </div>
                <button
                  onClick={() => handleOrganizeFolder(folder)}
                  disabled={processingId === folder.id}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: processingId === folder.id ? '#ccc' : '#9C27B0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: processingId === folder.id ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {processingId === folder.id ? '整理中...' : '整理此文件夹'}
                </button>
              </div>
            ))}
          </div>

          <div style={{ 
            marginTop: '30px',
            textAlign: 'center'
          }}>
            <button 
              onClick={() => window.close()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              关闭
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// 渲染React组件
const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(<FolderSelectorPage />);
}