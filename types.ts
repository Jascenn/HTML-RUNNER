
export enum EditorMode {
  EDIT = 'EDIT',
  PREVIEW = 'PREVIEW',
  SPLIT = 'SPLIT'
}

export type Language = 'en' | 'zh';
export type Theme = 'light' | 'dark';

export interface CodeFile {
  id: string;
  name: string;
  content: string;
}

export interface Snippet {
  id: string;
  name: string;
  code: string;
}

export const TRANSLATIONS = {
  en: {
    title: "LingYi HTML Runner",
    subtitle: "HTML5/CSS3/ES6 Playground",
    run: "Run",
    export: "Export",
    copy: "Copy",
    copied: "Copied",
    clear: "Clear",
    format: "Format",
    lint: "Lint",
    validate: "Validate",
    explain: "Explain Code",
    undo: "Undo",
    redo: "Redo",
    source: "Source Code",
    preview: "Preview",
    aiAssist: "AI Assist",
    aiPromptPlaceholder: "Describe the UI component or page you want to build...",
    generating: "Generating...",
    checking: "Checking...",
    validating: "Validating...",
    explaining: "Analyzing code...",
    noErrors: "No issues found!",
    confirmClear: "Are you sure you want to clear the editor?",
    lintTitle: "Code Analysis",
    validateTitle: "W3C Compliance Check",
    explainTitle: "Code Explanation",
    lintDesc: "AI-powered code quality check",
    close: "Close",
    editor: "Editor",
    view: "View",
    split: "Split",
    saved: "Saved",
    saving: "Saving...",
    applyCode: "Copy to Editor",
    tryAgain: "Refine / Try Again",
    generatedPreview: "Preview Generated Code",
    examplePrompts: "Try these examples:",
    examples: [
      "Create a responsive navigation bar with a dark theme",
      "Build a contact form with validation",
      "Create a pricing table with 3 cards",
      "Make a simple Todo List app"
    ],
    commandPalette: "Command Palette",
    searchCommands: "Type a command...",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    newFile: "New File",
    deleteFile: "Delete File",
    renameFile: "Rename File",
    snippets: "Snippets",
    addSnippet: "Add Selection as Snippet",
    insertSnippet: "Insert Snippet",
    noSnippets: "No snippets found.",
    confirmDeleteFile: "Are you sure you want to delete this file?",
    fileCreated: "File created",
    snippetAdded: "Snippet added",
    snippetInserted: "Snippet inserted",
    manageSnippets: "Manage Snippets",
    quickKeywords: "Quick Keywords",
    beautifyCss: "Beautify CSS",
    snippetManager: "Snippet Manager",
    searchSnippets: "Search snippets...",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    previewLoading: "Updating preview...",
    errorGeneric: "An error occurred",
    snippetSaved: "Snippet saved",
    snippetDeleted: "Snippet deleted",
    saveAll: "Save All",
    allFilesSaved: "All files saved successfully",
    saveAs: "Save As",
    enterFilename: "Enter filename to save as:",
    fileSavedAs: "File saved successfully"
  },
  zh: {
    title: "LingYi HTML 运行器",
    subtitle: "HTML5/CSS3/ES6 在线运行",
    run: "运行",
    export: "导出",
    copy: "复制",
    copied: "已复制",
    clear: "清空",
    format: "格式化",
    lint: "检查",
    validate: "验证",
    explain: "解释代码",
    undo: "撤销",
    redo: "重做",
    source: "源代码",
    preview: "效果预览",
    aiAssist: "AI 助手",
    aiPromptPlaceholder: "描述你想创建的页面或组件...",
    generating: "生成中...",
    checking: "检查中...",
    validating: "验证中...",
    explaining: "分析代码中...",
    noErrors: "未发现问题！",
    confirmClear: "确定要清空编辑器吗？",
    lintTitle: "代码分析",
    validateTitle: "W3C 合规性检查",
    explainTitle: "代码详解",
    lintDesc: "AI 智能代码质量检测",
    close: "关闭",
    editor: "编辑器",
    view: "视图",
    split: "分屏",
    saved: "已保存",
    saving: "保存中...",
    applyCode: "应用到编辑器",
    tryAgain: "调整 / 重试",
    generatedPreview: "生成代码预览",
    examplePrompts: "尝试这些示例：",
    examples: [
      "创建一个深色主题的响应式导航栏",
      "制作一个带有验证功能的联系表单",
      "创建一个包含3个卡片的价格表",
      "制作一个简单的待办事项应用"
    ],
    commandPalette: "命令面板",
    searchCommands: "输入命令...",
    zoomIn: "放大",
    zoomOut: "缩小",
    newFile: "新建文件",
    deleteFile: "删除文件",
    renameFile: "重命名文件",
    snippets: "代码片段",
    addSnippet: "将选中内容添加为片段",
    insertSnippet: "插入片段",
    noSnippets: "暂无代码片段",
    confirmDeleteFile: "确定要删除此文件吗？",
    fileCreated: "文件已创建",
    snippetAdded: "片段已添加",
    snippetInserted: "片段已插入",
    manageSnippets: "管理代码片段",
    quickKeywords: "快捷关键词",
    beautifyCss: "美化 CSS",
    snippetManager: "片段管理器",
    searchSnippets: "搜索片段...",
    edit: "编辑",
    delete: "删除",
    save: "保存",
    cancel: "取消",
    previewLoading: "正在更新预览...",
    errorGeneric: "发生错误",
    snippetSaved: "片段已保存",
    snippetDeleted: "片段已删除",
    saveAll: "保存所有",
    allFilesSaved: "所有文件已保存",
    saveAs: "另存为",
    enterFilename: "输入要保存的文件名：",
    fileSavedAs: "文件已保存"
  }
};

export const DEFAULT_CODE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World</title>
    <style>
        :root {
            --primary-color: #0ea5e9;
            --primary-hover: #0284c7;
            --bg-color: #f0f2f5;
            --text-color: #333;
            --card-bg: #ffffff;
        }
        body {
            font-family: 'Fira Code', monospace;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background-color: var(--bg-color);
            color: var(--text-color);
        }
        .container {
            text-align: center;
            background: var(--card-bg);
            padding: 2rem 4rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: var(--primary-color);
            margin-bottom: 1rem;
        }
        button {
            margin-top: 1.5rem;
            padding: 0.5rem 1.5rem;
            background-color: var(--primary-color);
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        button:hover {
            background-color: var(--primary-hover);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>LingYi HTML</h1>
        <p>Edit the code on the left to see changes instantly.</p>
        <button onclick="changeText(this)">Click Me</button>
    </div>

    <script>
        function changeText(btn) {
            btn.textContent = "It Works!";
            btn.style.backgroundColor = "#10b981";
        }
    </script>
</body>
</html>`;

export const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: 's1',
    name: 'HTML5 Boilerplate',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    
</body>
</html>`
  },
  {
    id: 's2',
    name: 'Flexbox Center',
    code: `display: flex;
justify-content: center;
align-items: center;`
  },
  {
    id: 's3',
    name: 'Console Log',
    code: `console.log('Debug:', );`
  }
];

export const AI_KEYWORDS = [
  "Responsive", "Flexbox", "Grid Layout", "Dark Mode", "Animation", "Card", 
  "Navbar", "Footer", "Form", "Button", "Modal", "Table", "Gallery"
];