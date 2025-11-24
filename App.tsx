
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Code2, 
  Play, 
  Download, 
  Copy, 
  Sparkles, 
  Trash2, 
  Maximize2, 
  Columns,
  PanelLeft,
  X,
  Undo2,
  Redo2,
  Moon,
  Sun,
  Languages,
  CheckCircle2,
  AlertTriangle,
  AlignLeft,
  Check,
  Minimize2,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Plus,
  FileCode,
  Search,
  Command,
  MoreVertical,
  Scissors,
  ShieldCheck,
  Save,
  BookOpen,
  Settings,
  Edit2,
  Loader2,
  AlertCircle,
  Menu,
  SaveAll
} from 'lucide-react';
import { Button } from './components/Button';
import { generateHtmlCode, refineHtmlCode, auditCode, validateHtmlCode, explainCode } from './services/geminiService';
import { EditorMode, DEFAULT_CODE, Language, Theme, TRANSLATIONS, CodeFile, Snippet, DEFAULT_SNIPPETS, AI_KEYWORDS } from './types';

// Declare Prettier and CodeMirror on window
declare global {
  interface Window {
    prettier: any;
    prettierPlugins: any;
    CodeMirror: any;
  }
}

// Fallback formatter
const simpleFormat = (html: string) => {
  let formatted = '';
  let indent = '';
  const tab = '    ';
  html.split(/>\s*</).forEach(function(node) {
      if (node.match( /^\/\w/ )) indent = indent.substring(tab.length);
      formatted += indent + '<' + node + '>\r\n';
      if (node.match( /^<?\w[^>]*[^\/]$/ ) && !node.startsWith("input") && !node.startsWith("img") && !node.startsWith("br")) indent += tab;
  });
  return formatted.substring(1, formatted.length-3);
};

const App: React.FC = () => {
  // --- STATE ---

  // Theme & Language
  const getPreferredTheme = (): Theme => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('lingyi_theme');
    return (saved as Theme) || getPreferredTheme();
  });
  
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('lingyi_lang') as Language) || 'zh');
  const t = TRANSLATIONS[lang];

  // Files System
  const [files, setFiles] = useState<CodeFile[]>(() => {
    const savedFiles = localStorage.getItem('lingyi_files');
    if (savedFiles) {
        try {
            const parsed = JSON.parse(savedFiles);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
            console.error("Failed to parse saved files", e);
        }
    }
    const oldCode = localStorage.getItem('lingyi_code');
    return [{ id: '1', name: 'index.html', content: oldCode || DEFAULT_CODE }];
  });
  const [activeFileId, setActiveFileId] = useState<string>(() => localStorage.getItem('lingyi_active_file') || '1');

  // Computed
  const activeFile = files.find(f => f.id === activeFileId) || files[0];
  // Note: 'code' state might be up to 500ms old due to debounce. 
  // Use getCurrentCode() for actions like Run/Download.
  const code = activeFile?.content || '';

  // Refs for State Access in Closures/Callbacks
  const activeFileIdRef = useRef(activeFileId);
  const filesRef = useRef(files);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeFileIdRef.current = activeFileId;
    filesRef.current = files;
  }, [activeFileId, files]);

  // Editor Settings
  const [fontSize, setFontSize] = useState<number>(14);
  const [snippets, setSnippets] = useState<Snippet[]>(() => {
    const saved = localStorage.getItem('lingyi_snippets');
    return saved ? JSON.parse(saved) : DEFAULT_SNIPPETS;
  });

  // UI State
  const [activeMode, setActiveMode] = useState<EditorMode>(EditorMode.SPLIT);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);
  
  const [showLintModal, setShowLintModal] = useState(false);
  const [lintResult, setLintResult] = useState<string>('');
  const [isLinting, setIsLinting] = useState(false);

  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validateResult, setValidateResult] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);

  const [showExplainModal, setShowExplainModal] = useState(false);
  const [explainResult, setExplainResult] = useState<string>('');
  const [isExplaining, setIsExplaining] = useState(false);

  // Toast System
  const [toast, setToast] = useState<{show: boolean; message: string; type: 'success' | 'error' | 'info'}>({
    show: false,
    message: '',
    type: 'success'
  });
  
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');

  // Snippet Manager State
  const [showSnippetManager, setShowSnippetManager] = useState(false);
  const [snippetSearch, setSnippetSearch] = useState('');
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  // Preview State
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  
  // Mobile Menu
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const cmInstance = useRef<any>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  
  // --- HELPER: Get Live Code ---
  const getCurrentCode = useCallback(() => {
    if (cmInstance.current) {
      return cmInstance.current.getValue();
    }
    return activeFile?.content || '';
  }, [activeFile]);

  // --- LOGIC: Debounced Code Update ---
  const updateCodeDebounced = useCallback((newContent: string, targetFileId: string) => {
    setSaveStatus('saving');
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // 500ms delay: "When the user stops typing..."
    debounceTimeoutRef.current = setTimeout(() => {
      setFiles(prevFiles => 
        prevFiles.map(f => f.id === targetFileId ? { ...f, content: newContent } : f)
      );
      setSaveStatus('saved');
    }, 500);
  }, []);

  // Immediate update
  const updateCodeImmediate = (newContent: string) => {
    const currentId = activeFileIdRef.current;
    setFiles(prevFiles => 
      prevFiles.map(f => f.id === currentId ? { ...f, content: newContent } : f)
    );
    if (cmInstance.current && cmInstance.current.getValue() !== newContent) {
      cmInstance.current.setValue(newContent);
    }
    setSaveStatus('saved');
  };

  // --- EFFECTS ---

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorRef.current || cmInstance.current) return;

    if (window.CodeMirror) {
      const cm = window.CodeMirror(editorRef.current, {
        value: code,
        mode: "htmlmixed",
        theme: theme === 'dark' ? "dracula" : "default",
        lineNumbers: true,
        lineWrapping: true,
        tabSize: 2,
        autoCloseBrackets: true,
        matchBrackets: true,
        styleActiveLine: true,
        extraKeys: {
          "Ctrl-Space": "autocomplete",
          "Ctrl-Q": function(cm: any){ cm.foldCode(cm.getCursor()); }
        },
        hintOptions: {
          completeSingle: false,
          hint: (cm: any, options: any) => {
            const cur = cm.getCursor();
            const token = cm.getTokenAt(cur);
            
            const inner = window.CodeMirror.innerMode(cm.getMode(), token.state);
            if (inner.mode.name === 'css') {
              const text = cm.getValue();
              const variableRegex = /--[\w-]+/g;
              const variables = [...new Set(text.match(variableRegex) || [])] as string[];
              
              if (token.string.startsWith('--')) {
                const list = variables.filter(v => v.startsWith(token.string));
                return {
                  list: list,
                  from: window.CodeMirror.Pos(cur.line, token.start),
                  to: window.CodeMirror.Pos(cur.line, token.end)
                };
              }
            }
            
            if (inner.mode.name === 'css') return window.CodeMirror.hint.css(cm, options);
            if (inner.mode.name === 'javascript') return window.CodeMirror.hint.javascript(cm, options);
            return window.CodeMirror.hint.html(cm, options);
          }
        }
      });

      cm.on("keyup", function (cm: any, event: KeyboardEvent) {
          if (!cm.state.completionActive && 
              !event.ctrlKey && !event.altKey && !event.metaKey &&
              ((event.keyCode >= 65 && event.keyCode <= 90) || event.key === '-') 
          ) {
             window.CodeMirror.commands.autocomplete(cm, null, {completeSingle: false});
          }
      });

      cm.on('change', (instance: any, changeObj: any) => {
        if (changeObj.origin !== 'setValue') {
          const val = instance.getValue();
          updateCodeDebounced(val, activeFileIdRef.current); 
        }
      });

      cmInstance.current = cm;
    }
  }, [updateCodeDebounced]);

  // Sync React State -> CodeMirror
  useEffect(() => {
    if (cmInstance.current && code !== undefined) {
      const currentVal = cmInstance.current.getValue();
      if (currentVal !== code) {
        const info = cmInstance.current.getScrollInfo();
        const cursor = cmInstance.current.getCursor();
        cmInstance.current.setValue(code);
        cmInstance.current.scrollTo(info.left, info.top);
        cmInstance.current.setCursor(cursor);
      }
    }
  }, [activeFileId]);

  // Sync Theme -> CodeMirror
  useEffect(() => {
    if (cmInstance.current) {
      cmInstance.current.setOption("theme", theme === 'dark' ? "dracula" : "default");
    }
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('lingyi_theme', theme);
  }, [theme]);

  // Sync Font Size
  useEffect(() => {
    if (editorRef.current) {
      const cmWrapper = editorRef.current.querySelector('.CodeMirror') as HTMLElement;
      if (cmWrapper) {
        cmWrapper.style.fontSize = `${fontSize}px`;
        cmWrapper.style.lineHeight = '1.6';
        cmInstance.current?.refresh();
      }
    }
  }, [fontSize]);

  // Persistence
  useEffect(() => {
    localStorage.setItem('lingyi_files', JSON.stringify(files));
    localStorage.setItem('lingyi_active_file', activeFileId);
  }, [files, activeFileId]);

  useEffect(() => {
    localStorage.setItem('lingyi_lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('lingyi_snippets', JSON.stringify(snippets));
  }, [snippets]);

  // Preview Update Mechanism
  useEffect(() => {
     if (iframeRef.current) {
       // Only show loading if it actually takes a moment
       const timer = setTimeout(() => setIsPreviewLoading(true), 100);
       iframeRef.current.srcdoc = code || '';
       
       return () => clearTimeout(timer);
     }
  }, [code]);

  // Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isCtrlOrMeta && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if (isCtrlOrMeta && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
      if (isCtrlOrMeta && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveAll();
      }
      if (isCtrlOrMeta && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        handleFormat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [code, activeFileId, theme, lang]); 

  useEffect(() => {
    if (showCommandPalette && paletteInputRef.current) {
      setTimeout(() => paletteInputRef.current?.focus(), 50);
    }
    if (!showCommandPalette) setPaletteQuery('');
  }, [showCommandPalette]);

  // Responsive
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && activeMode === EditorMode.SPLIT) {
        setActiveMode(EditorMode.EDIT);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, [activeMode]);

  // --- HANDLERS ---

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const handleRun = () => {
    if (iframeRef.current) {
        setIsPreviewLoading(true);
        iframeRef.current.srcdoc = getCurrentCode();
    }
  };

  const handleUndo = () => cmInstance.current?.undo();
  const handleRedo = () => cmInstance.current?.redo();

  const handleFormat = () => {
    const currentCode = getCurrentCode();
    try {
      if (window.prettier && window.prettierPlugins) {
        const formatted = window.prettier.format(currentCode, {
          parser: "html",
          plugins: window.prettierPlugins,
          printWidth: 80,
          tabWidth: 2,
          useTabs: false,
        });
        updateCodeImmediate(formatted);
      } else {
        updateCodeImmediate(simpleFormat(currentCode));
      }
      showToast(t.saved, 'success');
    } catch(e) { 
      console.error(e);
      showToast("Formatting Error", 'error');
    }
  };

  const handleLint = async () => {
    const currentCode = getCurrentCode();
    setShowLintModal(true);
    setIsLinting(true);
    setLintResult('');
    try {
      const result = await auditCode(currentCode);
      setLintResult(result);
    } catch (e: any) {
      console.error("Lint failed:", e);
      showToast(`${t.errorGeneric}: ${e.message}`, 'error');
      setLintResult(`<div class="text-red-500 font-medium p-2">Analysis Failed: ${e.message || "Unknown error"}. Please try again later.</div>`);
    } finally {
      setIsLinting(false);
    }
  };

  const handleValidate = async () => {
    const currentCode = getCurrentCode();
    setShowValidateModal(true);
    setIsValidating(true);
    setValidateResult('');
    try {
      const result = await validateHtmlCode(currentCode);
      setValidateResult(result);
    } catch (e: any) {
      console.error("Validation failed:", e);
      showToast(`${t.errorGeneric}: ${e.message}`, 'error');
      setValidateResult(`<div class="text-red-500 font-medium p-2">Validation Failed: ${e.message || "Unknown error"}. Please try again later.</div>`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleExplain = async () => {
    const currentCode = getCurrentCode();
    setShowExplainModal(true);
    setIsExplaining(true);
    setExplainResult('');
    try {
      const result = await explainCode(currentCode);
      setExplainResult(result);
    } catch (e: any) {
      showToast(`${t.errorGeneric}: ${e.message}`, 'error');
      setExplainResult(`<p class="text-red-500">Explanation Failed: ${e.message}</p>`);
    } finally {
      setIsExplaining(false);
    }
  };

  const handleDownload = () => {
    const currentCode = getCurrentCode();
    const blob = new Blob([currentCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name || 'index.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveAs = () => {
    const currentCode = getCurrentCode();
    const defaultName = activeFile.name || 'index.html';
    const filename = prompt(t.enterFilename, defaultName);
    
    if (!filename) return;

    const finalFilename = filename.endsWith('.html') ? filename : `${filename}.html`;
    const blob = new Blob([currentCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t.fileSavedAs, 'success');
  };

  const handleSaveAll = () => {
    // Force update the state with the immediate editor content to ensure the active file is saved correctly
    const currentCode = getCurrentCode();
    updateCodeImmediate(currentCode);
    // Note: Inactive files are already persisted in 'files' state, and the useEffect handles localStorage
    showToast(t.allFilesSaved, 'success');
  };

  const handleClear = () => {
    if (window.confirm(t.confirmClear)) {
      updateCodeImmediate('');
    }
  };

  // AI
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    const currentCode = getCurrentCode();
    
    try {
      const result = currentCode.trim().length > 0 && currentCode !== DEFAULT_CODE
        ? await refineHtmlCode(currentCode, aiPrompt)
        : await generateHtmlCode(aiPrompt);
      setGeneratedPreview(result);
    } catch (error: any) {
      console.error("AI Gen Failed:", error);
      showToast(`AI Error: ${error.message || "Request failed"}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const applyGeneratedCode = () => {
    if (generatedPreview) {
      updateCodeImmediate(generatedPreview);
      setGeneratedPreview(null);
      setShowAiModal(false);
      setAiPrompt('');
    }
  };

  // Files
  const handleNewFile = () => {
    const newFile: CodeFile = {
      id: Date.now().toString(),
      name: `page-${files.length + 1}.html`,
      content: ''
    };
    const newFiles = [...files, newFile];
    setFiles(newFiles);
    setActiveFileId(newFile.id);
    showToast(t.fileCreated, 'success');
  };

  const handleDeleteFile = (id: string, e: React.MouseEvent) => {
    // Crucial: Stop propagation to prevent selecting the tab while deleting
    e.preventDefault();
    e.stopPropagation(); 
    
    if (files.length <= 1) {
      showToast("Cannot delete the last file", "info");
      return;
    }

    if (window.confirm(t.confirmDeleteFile)) {
      const newFiles = files.filter(f => f.id !== id);
      setFiles(newFiles);
      
      // If we deleted the active file, switch to a neighbor
      if (activeFileId === id) {
        const index = files.findIndex(f => f.id === id);
        // Try to switch to the previous one (left), if not, next one (which becomes current index)
        let newActiveId;
        if (index > 0 && files[index - 1]) {
           newActiveId = files[index - 1].id;
        } else {
           // If we deleted the first one, the new first one is at index 0 of newFiles
           newActiveId = newFiles[0]?.id;
        }
        
        if (newActiveId) {
          setActiveFileId(newActiveId);
        }
      }
      showToast("File deleted", "info");
    }
  };

  const handleRenameFile = (id: string, newName: string) => {
    if (!newName.trim()) return;
    setFiles(files.map(f => f.id === id ? { ...f, name: newName } : f));
  };

  // Snippets
  const handleAddSnippet = () => {
    const selection = cmInstance.current?.getSelection();
    if (selection) {
      const name = prompt("Enter snippet name:");
      if (name) {
        setSnippets([...snippets, { id: Date.now().toString(), name, code: selection }]);
        showToast(t.snippetAdded, 'success');
      }
    } else {
      alert("Please select some code to create a snippet.");
    }
  };

  const handleInsertSnippet = (snippetCode: string) => {
    if (cmInstance.current) {
      cmInstance.current.replaceSelection(snippetCode);
      showToast(t.snippetInserted, 'success');
      cmInstance.current.focus();
    }
  };

  const saveEditedSnippet = () => {
    if (editingSnippet) {
      setSnippets(prev => prev.map(s => s.id === editingSnippet.id ? editingSnippet : s));
      setEditingSnippet(null);
      showToast(t.snippetSaved, 'success');
    }
  };

  const deleteSnippet = (id: string) => {
    if(window.confirm(t.confirmDeleteFile)) {
      setSnippets(prev => prev.filter(s => s.id !== id));
      showToast(t.snippetDeleted, 'info');
    }
  };

  // Zoom
  const handleZoomIn = () => setFontSize(prev => Math.min(prev + 2, 32));
  const handleZoomOut = () => setFontSize(prev => Math.max(prev - 2, 10));

  return (
    <div className="h-screen flex flex-col bg-brand-50 dark:bg-dark-bg text-gray-900 dark:text-dark-text transition-colors duration-200">
      
      {/* HEADER */}
      <header className="h-16 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface px-3 md:px-4 flex items-center justify-between shrink-0 relative z-20 shadow-sm">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-brand-500/30 shrink-0">
              <Code2 className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-lg leading-tight tracking-tight text-gray-900 dark:text-white">LingYi</h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">HTML RUNNER</p>
            </div>
          </div>
          
          <div className="h-8 w-[1px] bg-gray-200 dark:bg-dark-border mx-1 hidden md:block"></div>

          {/* View Controls */}
          <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
             <button
               onClick={() => setActiveMode(EditorMode.EDIT)}
               className={`p-1.5 rounded-md transition-all ${activeMode === EditorMode.EDIT ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'}`}
               title={t.editor}
             >
               <PanelLeft className="w-4 h-4" />
             </button>
             <button
               onClick={() => setActiveMode(EditorMode.SPLIT)}
               className={`p-1.5 rounded-md transition-all hidden md:block ${activeMode === EditorMode.SPLIT ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'}`}
               title={t.split}
             >
               <Columns className="w-4 h-4" />
             </button>
             <button
               onClick={() => setActiveMode(EditorMode.PREVIEW)}
               className={`p-1.5 rounded-md transition-all ${activeMode === EditorMode.PREVIEW ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'}`}
               title={t.preview}
             >
               <Maximize2 className="w-4 h-4" />
             </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <Button variant="primary" onClick={handleRun} icon={<Play className="w-4 h-4 fill-current" />} size="sm" title={`${t.run} (Ctrl+Enter)`}>
            <span className="hidden sm:inline">{t.run}</span>
            <span className="sm:hidden">Run</span>
          </Button>
          
          <div className="w-[1px] h-6 bg-gray-200 dark:bg-dark-border mx-1"></div>

          {/* Desktop Toolbar */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAiModal(true)} title={t.aiAssist}>
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExplain} title={t.explain}>
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLint} title={t.lint}>
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleValidate} title={t.validate}>
              <ShieldCheck className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </Button>

            <div className="w-[1px] h-6 bg-gray-200 dark:bg-dark-border mx-1"></div>

            <Button variant="ghost" size="sm" onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} title="Switch Language">
              <Languages className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Toggle Theme">
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button variant="ghost" size="sm" onClick={() => setShowMobileMenu(!showMobileMenu)}>
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Mobile Dropdown Menu */}
      {showMobileMenu && (
        <div className="md:hidden absolute top-16 right-0 left-0 z-30 bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border shadow-lg animate-in slide-in-from-top-5">
          <div className="grid grid-cols-4 gap-2 p-4">
             <button onClick={() => { setShowAiModal(true); setShowMobileMenu(false); }} className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800">
               <Sparkles className="w-5 h-5 text-purple-600" />
               <span className="text-[10px]">{t.aiAssist}</span>
             </button>
             <button onClick={() => { handleExplain(); setShowMobileMenu(false); }} className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800">
               <BookOpen className="w-5 h-5 text-blue-600" />
               <span className="text-[10px]">{t.explain}</span>
             </button>
             <button onClick={() => { handleLint(); setShowMobileMenu(false); }} className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800">
               <CheckCircle2 className="w-5 h-5 text-green-600" />
               <span className="text-[10px]">{t.lint}</span>
             </button>
             <button onClick={() => { handleValidate(); setShowMobileMenu(false); }} className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800">
               <ShieldCheck className="w-5 h-5 text-orange-600" />
               <span className="text-[10px]">{t.validate}</span>
             </button>
             <button onClick={() => { setLang(lang === 'en' ? 'zh' : 'en'); setShowMobileMenu(false); }} className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800">
               <Languages className="w-5 h-5 text-gray-600 dark:text-gray-300" />
               <span className="text-[10px]">Lang</span>
             </button>
             <button onClick={() => { setTheme(theme === 'light' ? 'dark' : 'light'); setShowMobileMenu(false); }} className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800">
               {theme === 'light' ? <Moon className="w-5 h-5 text-gray-600" /> : <Sun className="w-5 h-5 text-yellow-400" />}
               <span className="text-[10px]">Theme</span>
             </button>
             <button onClick={() => { setShowSnippetManager(true); setShowMobileMenu(false); }} className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800">
               <Scissors className="w-5 h-5 text-gray-600 dark:text-gray-300" />
               <span className="text-[10px]">Snippets</span>
             </button>
             <button onClick={() => { setShowCommandPalette(true); setShowMobileMenu(false); }} className="flex flex-col items-center gap-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800">
               <Command className="w-5 h-5 text-gray-600 dark:text-gray-300" />
               <span className="text-[10px]">Cmds</span>
             </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* EDITOR PANE */}
        <div className={`flex flex-col bg-white dark:bg-dark-bg border-r border-gray-200 dark:border-dark-border transition-all duration-300 ${
          activeMode === EditorMode.PREVIEW ? 'hidden' : activeMode === EditorMode.SPLIT ? 'w-1/2' : 'w-full'
        }`}>
          {/* Editor Toolbar */}
          <div className="h-10 border-b border-gray-200 dark:border-dark-border flex items-center justify-between px-2 bg-gray-50 dark:bg-dark-surface/50">
             <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[60%]">
                {files.map(file => (
                  <div 
                    key={file.id} 
                    className={`group flex items-center gap-2 px-3 py-1.5 text-xs rounded-t-md cursor-pointer border-t-2 transition-colors relative shrink-0 ${
                      activeFileId === file.id 
                      ? 'bg-white dark:bg-dark-bg border-brand-500 text-brand-600 dark:text-brand-400 font-medium' 
                      : 'border-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => setActiveFileId(file.id)}
                    title={file.name}
                  >
                    <FileCode className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[80px] sm:max-w-[120px]" onDoubleClick={() => {
                        const newName = prompt("Rename file:", file.name);
                        if(newName) handleRenameFile(file.id, newName);
                    }}>{file.name}</span>
                    
                    {files.length > 1 && (
                      <button 
                        type="button"
                        className="ml-1 p-0.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors z-20 focus:outline-none"
                        onClick={(e) => handleDeleteFile(file.id, e)}
                        onMouseDown={(e) => e.stopPropagation()}
                        onMouseUp={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        title={t.deleteFile}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={handleNewFile} className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 shrink-0" title={t.newFile}>
                  <Plus className="w-4 h-4" />
                </button>
             </div>

             <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pl-2">
                <button onClick={() => setShowSnippetManager(true)} className="hidden md:block p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-100 dark:hover:bg-slate-700" title={t.manageSnippets}>
                  <Scissors className="w-3.5 h-3.5" />
                </button>
                <div className="hidden md:block w-[1px] h-4 bg-gray-300 dark:bg-slate-700 mx-1"></div>
                <button onClick={handleUndo} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-100 dark:hover:bg-slate-700" title={`${t.undo} (Ctrl+Z)`}>
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleRedo} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-100 dark:hover:bg-slate-700" title={`${t.redo} (Ctrl+Y)`}>
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <div className="hidden sm:block w-[1px] h-4 bg-gray-300 dark:bg-slate-700 mx-1"></div>
                <button onClick={handleZoomOut} className="hidden sm:block p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-100 dark:hover:bg-slate-700" title={t.zoomOut}>
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleZoomIn} className="hidden sm:block p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-100 dark:hover:bg-slate-700" title={t.zoomIn}>
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <div className="w-[1px] h-4 bg-gray-300 dark:bg-slate-700 mx-1"></div>
                <button onClick={handleFormat} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-100 dark:hover:bg-slate-700" title={`${t.format} (Ctrl+Shift+F)`}>
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleSaveAll} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-100 dark:hover:bg-slate-700" title={`${t.saveAll} (Ctrl+S)`}>
                  <SaveAll className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleSaveAs} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-100 dark:hover:bg-slate-700" title={t.saveAs}>
                  <Download className="w-3.5 h-3.5" />
                </button>
             </div>
          </div>

          {/* CodeMirror Container */}
          <div className="flex-1 relative overflow-hidden bg-white dark:bg-[#282a36]">
             <div ref={editorRef} className="h-full w-full text-base" />
          </div>

          {/* Footer Stats & Auto Save */}
          <div className="h-6 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface px-3 flex items-center justify-between text-[10px] text-gray-500">
             <div className="flex items-center gap-3">
               <span>HTML5 / CSS3 / JS</span>
               <span>UTF-8</span>
               <span>{files.length} {files.length === 1 ? 'file' : 'files'}</span>
             </div>
             <div className="flex items-center gap-1.5">
               {saveStatus === 'saving' ? (
                 <span className="flex items-center gap-1 text-blue-500">
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                   {t.saving}
                 </span>
               ) : (
                 <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                   <Check className="w-3 h-3" />
                   {t.saved}
                 </span>
               )}
             </div>
          </div>
        </div>

        {/* PREVIEW PANE */}
        <div className={`flex flex-col bg-gray-100 dark:bg-[#000] transition-all duration-300 relative ${
           activeMode === EditorMode.EDIT ? 'hidden' : activeMode === EditorMode.SPLIT ? 'w-1/2' : 'w-full'
        }`}>
          {/* Loading Spinner for Preview */}
          {isPreviewLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm">
               <div className="bg-white dark:bg-dark-surface px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border border-gray-100 dark:border-dark-border">
                 <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                 <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t.previewLoading}</span>
               </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            title="preview"
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-modals allow-same-origin"
            onLoad={() => setIsPreviewLoading(false)}
          />
        </div>

        {/* Command Palette Modal */}
        {showCommandPalette && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20" onClick={() => setShowCommandPalette(false)}>
             <div className="w-full max-w-[500px] mx-4 bg-white dark:bg-dark-surface rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden flex flex-col max-h-[400px]" onClick={e => e.stopPropagation()}>
                <div className="p-3 border-b border-gray-100 dark:border-dark-border flex items-center gap-2">
                  <Search className="w-5 h-5 text-gray-400" />
                  <input 
                    ref={paletteInputRef}
                    type="text" 
                    className="flex-1 bg-transparent border-none outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400"
                    placeholder={t.searchCommands}
                    value={paletteQuery}
                    onChange={(e) => setPaletteQuery(e.target.value)}
                  />
                  <span className="text-xs text-gray-400 px-1.5 py-0.5 border border-gray-200 dark:border-dark-border rounded">Esc</span>
                </div>
                <div className="overflow-y-auto p-1 custom-scrollbar">
                  {[
                    { icon: <Play className="w-4 h-4" />, label: t.run, action: handleRun, shortcut: "Ctrl+Enter" },
                    { icon: <AlignLeft className="w-4 h-4" />, label: t.format, action: handleFormat, shortcut: "Ctrl+Shift+F" },
                    { icon: <BookOpen className="w-4 h-4" />, label: t.explain, action: handleExplain },
                    { icon: <CheckCircle2 className="w-4 h-4" />, label: t.lint, action: handleLint },
                    { icon: <ShieldCheck className="w-4 h-4" />, label: t.validate, action: handleValidate },
                    { icon: <Download className="w-4 h-4" />, label: t.saveAs, action: handleSaveAs },
                    { icon: <Download className="w-4 h-4" />, label: t.export, action: handleDownload },
                    { icon: <Sparkles className="w-4 h-4" />, label: t.aiAssist, action: () => setShowAiModal(true) },
                    { icon: <Scissors className="w-4 h-4" />, label: t.addSnippet, action: handleAddSnippet },
                    { icon: <Settings className="w-4 h-4" />, label: t.manageSnippets, action: () => setShowSnippetManager(true) },
                    { icon: <SaveAll className="w-4 h-4" />, label: t.saveAll, action: handleSaveAll },
                    { icon: <Trash2 className="w-4 h-4" />, label: t.clear, action: handleClear },
                  ].filter(cmd => cmd.label.toLowerCase().includes(paletteQuery.toLowerCase())).map((cmd, i) => (
                    <button 
                      key={i}
                      className="w-full text-left px-3 py-2.5 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-gray-700 dark:text-gray-200 rounded-md flex items-center justify-between group"
                      onClick={() => { cmd.action(); setShowCommandPalette(false); }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 group-hover:text-brand-500">{cmd.icon}</span>
                        <span>{cmd.label}</span>
                      </div>
                      {cmd.shortcut && <span className="text-xs text-gray-400 font-mono">{cmd.shortcut}</span>}
                    </button>
                  ))}
                  {/* Snippets Section in Palette */}
                  {snippets.length > 0 && (
                     <>
                       <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider mt-2">{t.snippets}</div>
                       {snippets.filter(s => s.name.toLowerCase().includes(paletteQuery.toLowerCase())).map(s => (
                         <button
                           key={s.id}
                           className="w-full text-left px-3 py-2 hover:bg-brand-50 dark:hover:bg-brand-900/20 text-gray-700 dark:text-gray-200 rounded-md flex items-center gap-3 group"
                           onClick={() => { handleInsertSnippet(s.code); setShowCommandPalette(false); }}
                         >
                           <FileCode className="w-4 h-4 text-gray-400 group-hover:text-brand-500" />
                           {s.name}
                         </button>
                       ))}
                     </>
                  )}
                </div>
             </div>
          </div>
        )}

      </main>

      {/* MODALS */}
      
      {/* Snippet Manager Modal */}
      {showSnippetManager && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] border border-gray-200 dark:border-dark-border">
              <div className="p-4 border-b border-gray-200 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-surface">
                 <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                   <Scissors className="w-5 h-5 text-brand-500" />
                   {t.snippetManager}
                 </h2>
                 <button onClick={() => { setShowSnippetManager(false); setEditingSnippet(null); }} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                   <X className="w-5 h-5" />
                 </button>
              </div>
              
              <div className="p-4 border-b border-gray-200 dark:border-dark-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder={t.searchSnippets}
                    className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-dark-bg rounded-lg text-sm border-transparent focus:border-brand-500 focus:bg-white dark:focus:bg-dark-bg focus:ring-0 transition-colors"
                    value={snippetSearch}
                    onChange={(e) => setSnippetSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                 {editingSnippet ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                       <div>
                         <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                         <input 
                           type="text" 
                           value={editingSnippet.name}
                           onChange={(e) => setEditingSnippet({...editingSnippet, name: e.target.value})}
                           className="w-full p-2 rounded-md border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm"
                         />
                       </div>
                       <div>
                         <label className="block text-xs font-medium text-gray-500 mb-1">Code</label>
                         <textarea 
                           value={editingSnippet.code}
                           onChange={(e) => setEditingSnippet({...editingSnippet, code: e.target.value})}
                           className="w-full h-48 p-3 rounded-md border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg font-mono text-sm resize-none"
                         />
                       </div>
                       <div className="flex gap-2 justify-end">
                         <Button variant="secondary" onClick={() => setEditingSnippet(null)} size="sm">{t.cancel}</Button>
                         <Button variant="primary" onClick={saveEditedSnippet} size="sm">{t.save}</Button>
                       </div>
                    </div>
                 ) : (
                   snippets.filter(s => s.name.toLowerCase().includes(snippetSearch.toLowerCase())).length > 0 ? (
                     snippets.filter(s => s.name.toLowerCase().includes(snippetSearch.toLowerCase())).map(s => (
                       <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg/50 transition-colors group">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center font-mono text-xs font-bold">
                               {'</>'}
                             </div>
                             <div>
                               <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{s.name}</p>
                               <p className="text-xs text-gray-500 font-mono truncate max-w-[200px]">{s.code.substring(0, 30)}...</p>
                             </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => setEditingSnippet(s)} className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded" title={t.edit}>
                               <Edit2 className="w-4 h-4" />
                             </button>
                             <button onClick={() => deleteSnippet(s.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title={t.delete}>
                               <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       </div>
                     ))
                   ) : (
                     <div className="text-center py-8 text-gray-500 text-sm">
                       {t.noSnippets}
                     </div>
                   )
                 )}
              </div>
           </div>
      </div>
      )}

      {/* AI Modal */}
      {showAiModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-dark-border">
            <div className="p-4 border-b border-gray-200 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-surface">
              <div className="flex items-center gap-2">
                 <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                   <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                 </div>
                 <div>
                   <h2 className="font-semibold text-gray-900 dark:text-white">{t.aiAssist}</h2>
                   <p className="text-xs text-gray-500">Powered by Gemini 2.5</p>
                 </div>
              </div>
              <button onClick={() => setShowAiModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!generatedPreview ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t.aiPromptPlaceholder}
                    </label>
                    <div className="relative">
                      <textarea 
                        className="w-full h-32 p-3 pb-8 rounded-xl border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        placeholder="e.g., Create a responsive dashboard layout with a sidebar and header..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                      />
                      <div className="absolute bottom-2 right-3 text-xs text-gray-400">
                        {aiPrompt.length} chars
                      </div>
                    </div>
                  </div>

                  {/* Quick Keywords */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t.quickKeywords}</p>
                    <div className="flex flex-wrap gap-2">
                      {AI_KEYWORDS.map((kw, i) => (
                        <button
                          key={i}
                          onClick={() => setAiPrompt(prev => prev + (prev ? " " : "") + kw)}
                          className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-dark-bg text-sm text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-700 dark:hover:text-purple-300 transition-colors border border-transparent hover:border-purple-200 dark:hover:border-purple-800"
                        >
                          + {kw}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t.examplePrompts}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {t.examples.map((ex, i) => (
                        <button 
                          key={i}
                          onClick={() => setAiPrompt(ex)}
                          className="text-left p-3 rounded-lg border border-gray-200 dark:border-dark-border hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm text-gray-600 dark:text-gray-300 transition-all"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 dark:text-white">{t.generatedPreview}</h3>
                  </div>
                  <div className="flex-1 border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden relative bg-gray-100">
                    <iframe 
                      srcDoc={generatedPreview} 
                      className="w-full h-full"
                      title="AI Preview"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface flex justify-end gap-3">
              {generatedPreview ? (
                <>
                  <Button variant="secondary" onClick={() => setGeneratedPreview(null)}>
                    {t.tryAgain}
                  </Button>
                  <Button variant="primary" onClick={applyGeneratedCode} icon={<Check className="w-4 h-4"/>}>
                    {t.applyCode}
                  </Button>
                </>
              ) : (
                <Button 
                  variant="primary" 
                  onClick={handleAiGenerate} 
                  isLoading={isGenerating}
                  disabled={!aiPrompt.trim()}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  Generate
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Explain Code Modal */}
      {showExplainModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-dark-border flex flex-col max-h-[85vh]">
             <div className="p-4 border-b border-gray-200 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-surface">
               <div className="flex items-center gap-2">
                 <BookOpen className="w-5 h-5 text-blue-500" />
                 <h2 className="font-semibold text-gray-900 dark:text-white">{t.explainTitle}</h2>
               </div>
               <button onClick={() => setShowExplainModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <X className="w-5 h-5" />
               </button>
             </div>
             <div className="p-6 overflow-y-auto">
                {isExplaining ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mb-4"></div>
                    <p>{t.explaining}</p>
                  </div>
                ) : (
                  <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: explainResult }} />
                )}
             </div>
             <div className="p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface flex justify-end">
                <Button onClick={() => setShowExplainModal(false)}>{t.close}</Button>
             </div>
          </div>
        </div>
      )}

      {/* Lint Modal */}
      {showLintModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-dark-border">
             <div className="p-4 border-b border-gray-200 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-surface">
               <div className="flex items-center gap-2">
                 <AlertTriangle className="w-5 h-5 text-orange-500" />
                 <h2 className="font-semibold text-gray-900 dark:text-white">{t.lintTitle}</h2>
               </div>
               <button onClick={() => setShowLintModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <X className="w-5 h-5" />
               </button>
             </div>
             <div className="p-6 max-h-[60vh] overflow-y-auto">
                {isLinting ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mb-4"></div>
                    <p>{t.checking}</p>
                  </div>
                ) : (
                  <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: lintResult }} />
                )}
             </div>
             <div className="p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface flex justify-end">
                <Button onClick={() => setShowLintModal(false)}>{t.close}</Button>
             </div>
          </div>
        </div>
      )}

      {/* Validation Modal */}
      {showValidateModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-dark-border">
             <div className="p-4 border-b border-gray-200 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-surface">
               <div className="flex items-center gap-2">
                 <ShieldCheck className="w-5 h-5 text-blue-600" />
                 <h2 className="font-semibold text-gray-900 dark:text-white">{t.validateTitle}</h2>
               </div>
               <button onClick={() => setShowValidateModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <X className="w-5 h-5" />
               </button>
             </div>
             <div className="p-6 max-h-[60vh] overflow-y-auto">
                {isValidating ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mb-4"></div>
                    <p>{t.validating}</p>
                  </div>
                ) : (
                  <div className="prose dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: validateResult }} />
                )}
             </div>
             <div className="p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface flex justify-end">
                <Button onClick={() => setShowValidateModal(false)}>{t.close}</Button>
             </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="absolute bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className={`px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium border ${
            toast.type === 'error' 
              ? 'bg-red-50 dark:bg-red-900/90 text-red-600 dark:text-red-100 border-red-200 dark:border-red-800' 
              : toast.type === 'info'
              ? 'bg-blue-50 dark:bg-blue-900/90 text-blue-600 dark:text-blue-100 border-blue-200 dark:border-blue-800'
              : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
          }`}>
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4" />
            ) : toast.type === 'info' ? (
              <Check className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-green-400 dark:text-green-600" />
            )}
            {toast.message}
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
