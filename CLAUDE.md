# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart Marks is a Chrome Extension for intelligent bookmark management that uses AI (LLM) to automatically categorize and organize bookmarks into appropriate folders.

## Current Project Status

**Early Planning Phase** - No code implementation exists yet. The project has completed a comprehensive technical feasibility study (see Chrome智能书签管理器.md).

## Recommended Technology Stack

Based on the feasibility study, use:
- **Framework**: Plasmo + React + TypeScript
- **Build Tool**: Vite (built into Plasmo)
- **Testing**: Jest + Playwright
- **Storage**: Chrome Storage API + IndexedDB
- **AI Integration**: OpenAI API + WebLLM fallback

## Development Setup Commands

Since the project hasn't been initialized yet, here are the recommended commands for setup:

```bash
# Initialize with Plasmo
npm create plasmo@latest --with-react --with-typescript

# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Package extension
npm run package
```

## Architecture Overview

The planned architecture includes:

1. **Service Worker (Background Script)**: Handles API calls and bookmark operations
2. **Popup**: Quick access interface for common operations
3. **Side Panel**: Detailed bookmark management interface (Chrome 114+)
4. **Options Page**: Settings and configuration
5. **Content Scripts**: For extracting page metadata when needed

## Key Chrome APIs

The extension will primarily use:
- `chrome.bookmarks.*` - Core bookmark operations
- `chrome.storage.*` - Local data persistence
- `chrome.runtime.*` - Extension lifecycle management
- `chrome.sidePanel.*` - Side panel UI (Chrome 114+)

## AI Integration Strategy

- **Primary**: Cloud-based LLM (OpenAI/Gemini) via background script
- **Processing Modes**: 
  - Real-time for new bookmarks
  - Batch processing for bulk operations
- **Privacy First**: Minimize data sent to external APIs

## Development Phases

Follow the 16-week roadmap from the feasibility study:
1. **Weeks 1-4**: MVP with basic bookmark management
2. **Weeks 5-8**: AI integration and smart categorization
3. **Weeks 9-12**: Advanced features and optimization
4. **Weeks 13-16**: Commercial features and market launch

## Important Considerations

- **Privacy**: Implement local-first processing where possible
- **Performance**: Optimize for handling large bookmark collections
- **User Experience**: Provide confidence scores and easy correction mechanisms for AI categorization
- **Chrome Restrictions**: Cannot modify root bookmarks folders (e.g., "Bookmarks Bar")

## 特殊要求

### 语言要求

- **所有回复必须使用中文**：包括代码注释、解释说明、错误信息等
- **Git 提交信息必须使用中文**：提交标题和描述都使用中文
- **文档和注释使用中文**：所有新创建的文档、代码注释都使用中文

### Git 提交规范

- **提交信息格式要求**：

  ```
  feat: 添加RAG检索增强功能
  
  - 实现向量数据库集成
  - 优化文档分块策略
  - 添加混合搜索支持
  
  🤖 Generated with [Claude Code](https://claude.ai/code)
  
  Co-Authored-By: Claude <noreply@anthropic.com>
  ```

- **必须包含 Co-author 信息**：每个提交都要包含 `Co-authored-by: Claude Code <claude-code@anthropic.com>`

- **使用中文提交类型**：

  - `feat`: 新功能
  - `fix`: 修复bug
  - `docs`: 文档更新
  - `style`: 代码格式调整
  - `refactor`: 重构代码
  - `test`: 测试相关
  - `chore`: 构建工具或辅助工具的变动

### 命令执行权限

- **常规 Linux 命令可直接执行**：
  - 文件操作：`ls`, `cd`, `cp`, `mv`, `mkdir`, `touch`, `cat`, `less`, `grep`, `find`
  - 文本处理：`sed`, `awk`, `sort`, `uniq`, `head`, `tail`, `wc`
  - 系统信息：`ps`, `top`, `df`, `du`, `free`, `whoami`, `pwd`
  - 网络工具：`ping`, `curl`, `wget`
  - 开发工具：`git status`, `git log`, `git diff`, `npm list`, `pip list`

- **需要确认的重要命令**：
  - 删除操作：`rm -rf`, `rmdir`
  - 系统级操作：`sudo`, `su`, `chmod 777`, `chown`
  - 网络配置：`iptables`, `netstat`, `ss`
  - 进程管理：`kill`, `killall`, `pkill`
  - 包管理：`apt install`, `yum install`, `npm install -g`
  - 数据库操作：`mysql`, `psql`, `mongo`
  - 服务管理：`systemctl`, `service`

### 个人开发偏好

- **代码风格**：使用2个空格缩进，不使用Tab（遵循JavaScript/TypeScript标准）
- **函数命名**：使用动词开头的驼峰命名，如 `getUserInfo()`, `processDocument()`
- **错误处理**：优先使用 try-catch，提供中文错误信息
- **日志格式**：使用中文日志信息，便于调试
- **注释语言**：所有代码注释使用中文
- **变量命名**：使用英文驼峰命名，但注释说明使用中文
- **函数设计**：单个函数不超过50行，职责单一
- **导入顺序**：React/浏览器API → 第三方库 → 本地模块，每组之间空一行
- **字符串处理**：优先使用模板字符串 `${}`，避免使用字符串拼接
- **文件路径**：使用相对路径和绝对路径，遵循项目结构
- **配置管理**：使用 `.env` 文件管理环境变量，敏感信息不写入代码
- **依赖管理**：使用 `package.json` 锁定版本，重要依赖添加中文注释说明用途

### 文档和注释偏好

- **函数文档**：所有函数必须有中文JSDoc注释，说明参数、返回值、异常
- **类文档**：类的作用、主要方法、使用示例都用中文描述
- **复杂逻辑**：超过5行的复杂逻辑必须添加中文注释解释
- **TODO标记**：使用中文 `// TODO: 待实现功能描述` 格式
- **代码示例**：在文档中提供中文注释的完整代码示例

### 测试和质量保证

- **测试覆盖**：重要函数必须有对应的测试用例
- **测试命名**：测试函数使用中文描述，如 `describe('用户登录', () => { it('成功场景', () => {}) })`
- **断言信息**：断言失败时提供中文错误信息
- **测试数据**：使用中文测试数据，更贴近实际使用场景
- **性能测试**：关键算法需要添加性能测试和基准测试
- **E2E测试**：使用Playwright进行端到端测试，测试Chrome扩展功能

### 调试和日志偏好

- **调试信息**：使用中文debug信息，便于定位问题
- **日志级别**：开发环境使用DEBUG，生产环境使用INFO
- **异常捕获**：捕获异常时记录中文上下文信息
- **打印调试**：临时调试可以使用console.log，但正式代码必须使用专门的日志库
- **错误追踪**：重要错误必须记录完整的中文错误堆栈

### 安全和性能偏好

- **输入验证**：所有外部输入必须验证，提供中文错误提示
- **敏感信息处理**：API密钥等敏感信息不写入代码，使用环境变量或安全存储
- **API限流**：重要接口添加速率限制，防止滥用
- **缓存策略**：合理使用Chrome Storage API和内存缓存，避免重复计算
- **资源清理**：及时清理事件监听器、定时器等资源，避免内存泄漏
- **权限最小化**：只请求必要的Chrome扩展权限

### 项目结构偏好

- **目录命名**：使用中文拼音或英文，避免中文目录名
- **文件分类**：工具函数放在 `src/utils/`，配置文件放在 `src/config/`，类型定义放在 `src/types/`
- **模块划分**：按功能模块划分，每个模块职责清晰
- **常量定义**：所有魔法数字和字符串定义为有意义的常量
- **环境隔离**：开发、测试、生产环境严格隔离
- **文件扩展名**：TypeScript文件使用`.ts`，React组件使用`.tsx`