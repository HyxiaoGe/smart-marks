const fs = require('fs');
const path = require('path');

// 创建目标目录
const targetDir = path.join(__dirname, '..', 'build', 'chrome-mv3-prod');

// 确保目录存在
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 要移动的文件模式
const patterns = {
  js: /\.(js)$/,
  html: /\.(html)$/,
  png: /\.(png)$/,
  manifest: /^manifest\.json$/
};

// 获取根目录
const rootDir = path.join(__dirname, '..');

// 读取根目录文件
const files = fs.readdirSync(rootDir);

// 移动匹配的文件
files.forEach(file => {
  const filePath = path.join(rootDir, file);
  
  // 检查是否是文件
  if (fs.statSync(filePath).isFile()) {
    // 检查是否匹配任何模式
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(file)) {
        const targetPath = path.join(targetDir, file);
        try {
          fs.renameSync(filePath, targetPath);
          console.log(`已移动: ${file}`);
        } catch (err) {
          console.error(`移动 ${file} 失败:`, err.message);
        }
        break;
      }
    }
  }
});

// 移动 static 目录
const staticDir = path.join(rootDir, 'static');
if (fs.existsSync(staticDir)) {
  const targetStaticDir = path.join(targetDir, 'static');
  try {
    // 递归复制目录
    copyDirectory(staticDir, targetStaticDir);
    // 删除原目录
    removeDirectory(staticDir);
    console.log('已移动: static/');
  } catch (err) {
    console.error('移动 static 目录失败:', err.message);
  }
}

// 检查并移动额外的页面文件
const extraPages = ['preview', 'folder-selector'];
extraPages.forEach(pageName => {
  const htmlFile = `${pageName}.html`;
  const jsPattern = new RegExp(`${pageName}\\.[a-f0-9]+\\.js$`);
  
  // 查找并移动HTML文件
  const htmlPath = path.join(rootDir, htmlFile);
  if (fs.existsSync(htmlPath)) {
    const targetHtmlPath = path.join(targetDir, htmlFile);
    try {
      fs.renameSync(htmlPath, targetHtmlPath);
      console.log(`已移动: ${htmlFile}`);
    } catch (err) {
      console.error(`移动 ${htmlFile} 失败:`, err.message);
    }
  }
  
  // 查找并移动对应的JS文件
  const rootFiles = fs.readdirSync(rootDir);
  const jsFile = rootFiles.find(file => jsPattern.test(file));
  if (jsFile) {
    const jsPath = path.join(rootDir, jsFile);
    const targetJsPath = path.join(targetDir, jsFile);
    try {
      fs.renameSync(jsPath, targetJsPath);
      console.log(`已移动: ${jsFile}`);
    } catch (err) {
      console.error(`移动 ${jsFile} 失败:`, err.message);
    }
  }
});


// 递归复制目录
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 递归删除目录
function removeDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(file => {
      const curPath = path.join(dir, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        removeDirectory(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dir);
  }
}

console.log('构建文件已移动到 build/chrome-mv3-prod/');