const fs = require('fs');
const path = require('path');

// 要清理的目录
const dirsToClean = [
  path.join(__dirname, '..', 'build'),
  path.join(__dirname, '..', '.plasmo')
];

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
    console.log(`已删除: ${dir}`);
  }
}

// 清理目录
dirsToClean.forEach(dir => {
  removeDirectory(dir);
});

console.log('清理完成！');