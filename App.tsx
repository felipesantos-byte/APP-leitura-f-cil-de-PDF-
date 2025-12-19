
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, Bookmark, FileText, Highlighter, Plus, Trash2, Search, X, ChevronLeft, ChevronRight, MessageSquare, Sun, Moon, Coffee, ZoomIn, ZoomOut, File, BookOpen } from 'lucide-react';
import { Highlight, DictionaryResult } from './types';
import { getWordInsights } from './geminiService';

// Standard PDF.js setup
const pdfjsLib = (window as any).pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const COLORS = [
  { name: 'Yellow', bg: 'bg-yellow-200', text: 'text-yellow-900', border: 'border-yellow-400' },
  { name: 'Blue', bg: 'bg-blue-200', text: 'text-blue-900', border: 'border-blue-400' },
  { name: 'Green', bg: 'bg-green-200', text: 'text-green-900', border: 'border-green-400' },
  { name: 'Pink', bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' },
];

type Theme = 'light' | 'sepia' | 'dark';
type ViewMode = 'single' | 'double';

const THEMES: Record<Theme, { bg: string; sidebar: string; text: string; header: string; border: string; canvasBg: string }> = {
  light: { 
    bg: 'bg-[#f8f5f0]', 
    sidebar: 'bg-white', 
    text: 'text-stone-800', 
    header: 'bg-white', 
    border: 'border-stone-200',
    canvasBg: 'bg-white'
  },
  sepia: { 
    bg: 'bg-[#f4ecd8]', 
    sidebar: 'bg-[#ece1c6]', 
    text: 'text-[#5b4636]', 
    header: 'bg-[#ece1c6]', 
    border: 'border-[#dcc8a4]',
    canvasBg: 'bg-[#fdf9f0]'
  },
  dark: { 
    bg: 'bg-[#121212]', 
    sidebar: 'bg-[#1e1e1e]', 
    text: 'text-stone-200', 
    header: 'bg-[#1e1e1e]', 
    border: 'border-stone-800',
    canvasBg: 'bg-[#2a2a2a]'
  }
};

const App: React.FC = () => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [isDictionaryLoading, setIsDictionaryLoading] = useState(false);
  const [dictionaryResult, setDictionaryResult] = useState<DictionaryResult | null>(null);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [activeNote, setActiveNote] = useState<string>('');
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('light');
  const [viewMode, setViewMode] = useState<ViewMode>('double');
  const [scale, setScale] = useState(1.2);
  
  const canvasRef1 = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTheme = THEMES[theme];

  // Handle PDF Upload
  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setCurrentPage(1);
    }
  };

  // Render Page
  const renderPage = useCallback(async (pageNumber: number, canvas: HTMLCanvasElement | null) => {
    if (!pdfDoc || !canvas || pageNumber > numPages || pageNumber < 1) return;

    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    await page.render(renderContext).promise;
  }, [pdfDoc, scale, numPages]);

  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage, canvasRef1.current);
      if (viewMode === 'double' && currentPage + 1 <= numPages) {
        renderPage(currentPage + 1, canvasRef2.current);
      }
    }
  }, [pdfDoc, currentPage, numPages, renderPage, scale, viewMode]);

  // Text Selection Logic
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      setSelectedText(selection.toString());
    } else {
      setSelectedText('');
    }
  };

  // AI Insights
  const fetchDictionary = async () => {
    if (!selectedText) return;
    setIsDictionaryLoading(true);
    const result = await getWordInsights(selectedText);
    setDictionaryResult(result);
    setIsDictionaryLoading(false);
  };

  // Add/Update Highlight
  const saveHighlight = () => {
    if (editingHighlightId) {
      setHighlights(prev => prev.map(h => 
        h.id === editingHighlightId ? { ...h, comment: activeNote } : h
      ));
    } else {
      const newHighlight: Highlight = {
        id: Math.random().toString(36).substr(2, 9),
        page: currentPage,
        text: selectedText,
        color: 'bg-stone-100',
        comment: activeNote,
        timestamp: Date.now(),
        rects: []
      };
      setHighlights([newHighlight, ...highlights]);
    }
    closeAnnotationModal();
  };

  const addHighlight = (color: string) => {
    const newHighlight: Highlight = {
      id: Math.random().toString(36).substr(2, 9),
      page: currentPage,
      text: selectedText,
      color: color,
      timestamp: Date.now(),
      rects: []
    };
    setHighlights([newHighlight, ...highlights]);
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
  };

  const openEditModal = (h: Highlight) => {
    setSelectedText(h.text);
    setActiveNote(h.comment || '');
    setEditingHighlightId(h.id);
    setShowAnnotationModal(true);
  };

  const closeAnnotationModal = () => {
    setShowAnnotationModal(false);
    setEditingHighlightId(null);
    setActiveNote('');
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
  };

  // Navigation
  const prevPage = () => {
    const step = viewMode === 'double' ? 2 : 1;
    setCurrentPage(prev => Math.max(prev - step, 1));
  };
  
  const nextPage = () => {
    const step = viewMode === 'double' ? 2 : 1;
    setCurrentPage(prev => Math.min(prev + step, numPages));
  };

  // Zoom
  const zoomIn = () => setScale(prev => Math.min(prev + 0.1, 3.0));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.4));

  return (
    <div className={`flex flex-col h-screen ${currentTheme.bg} transition-colors duration-300 overflow-hidden ${currentTheme.text}`}>
      {/* Header */}
      <header className={`h-14 ${currentTheme.header} border-b ${currentTheme.border} flex items-center justify-between px-6 z-20 shadow-sm transition-colors duration-300`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-600 rounded flex items-center justify-center text-white">
            <Book size={20} />
          </div>
          <h1 className="font-semibold tracking-tight hidden sm:block">Lumina Reader</h1>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          {/* View Mode Toggle */}
          {pdfDoc && (
            <div className={`flex p-1 rounded-full ${theme === 'dark' ? 'bg-stone-800' : 'bg-stone-100'}`}>
              <button 
                onClick={() => setViewMode('single')} 
                className={`p-1.5 rounded-full transition ${viewMode === 'single' ? 'bg-white shadow-sm text-amber-600' : 'text-stone-400'}`}
                title="Página Única"
              >
                <File size={16} />
              </button>
              <button 
                onClick={() => setViewMode('double')} 
                className={`p-1.5 rounded-full transition ${viewMode === 'double' ? 'bg-white shadow-sm text-amber-600' : 'text-stone-400'}`}
                title="Modo Livro (Duas Páginas)"
              >
                <BookOpen size={16} />
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          {pdfDoc && (
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${theme === 'dark' ? 'bg-stone-800' : 'bg-stone-100'}`}>
              <button onClick={zoomOut} className="p-1 hover:text-amber-500 transition" title="Reduzir fonte">
                <ZoomOut size={16} />
              </button>
              <span className="text-[10px] font-bold w-12 text-center opacity-60">{(scale * 100).toFixed(0)}%</span>
              <button onClick={zoomIn} className="p-1 hover:text-amber-500 transition" title="Aumentar fonte">
                <ZoomIn size={16} />
              </button>
            </div>
          )}

          {/* Theme Switcher */}
          <div className={`flex p-1 rounded-full ${theme === 'dark' ? 'bg-stone-800' : 'bg-stone-100'}`}>
            <button 
              onClick={() => setTheme('light')} 
              className={`p-1.5 rounded-full transition ${theme === 'light' ? 'bg-white shadow-sm text-amber-600' : 'text-stone-400'}`}
            >
              <Sun size={16} />
            </button>
            <button 
              onClick={() => setTheme('sepia')} 
              className={`p-1.5 rounded-full transition ${theme === 'sepia' ? 'bg-[#f4ecd8] shadow-sm text-amber-800' : 'text-stone-400'}`}
            >
              <Coffee size={16} />
            </button>
            <button 
              onClick={() => setTheme('dark')} 
              className={`p-1.5 rounded-full transition ${theme === 'dark' ? 'bg-stone-700 shadow-sm text-amber-400' : 'text-stone-400'}`}
            >
              <Moon size={16} />
            </button>
          </div>

          {!pdfDoc ? (
            <label className="bg-stone-800 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-stone-700 transition cursor-pointer">
              Carregar PDF
              <input type="file" accept="application/pdf" onChange={onFileChange} className="hidden" />
            </label>
          ) : (
            <div className="flex items-center gap-2 sm:gap-4">
               <span className="text-[10px] font-medium opacity-60 uppercase tracking-widest hidden md:block">
                Página {currentPage} / {numPages}
              </span>
              <div className={`flex p-0.5 rounded-lg ${theme === 'dark' ? 'bg-stone-800' : 'bg-stone-100'}`}>
                <button 
                  onClick={prevPage} 
                  disabled={currentPage <= 1}
                  className={`p-1.5 rounded-md disabled:opacity-30 transition ${theme === 'dark' ? 'hover:bg-stone-700' : 'hover:bg-white'}`}
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  onClick={nextPage} 
                  disabled={currentPage >= numPages || (viewMode === 'double' && currentPage >= numPages - 1)}
                  className={`p-1.5 rounded-md disabled:opacity-30 transition ${theme === 'dark' ? 'hover:bg-stone-700' : 'hover:bg-white'}`}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Highlights & Notes */}
        <aside className={`w-72 ${currentTheme.sidebar} border-r ${currentTheme.border} flex flex-col p-4 gap-4 overflow-y-auto hidden lg:flex transition-colors duration-300`}>
          <div className="flex items-center gap-2 opacity-70 mb-2">
            <Bookmark size={18} />
            <h2 className="text-sm font-bold uppercase tracking-wider">Marcadores</h2>
          </div>
          {highlights.length === 0 ? (
            <div className="text-center py-10 opacity-40">
              <Highlighter size={40} className="mx-auto mb-2" />
              <p className="text-xs">Nenhum marcador ainda.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {highlights.map(h => (
                <div 
                  key={h.id} 
                  onClick={() => h.comment && openEditModal(h)}
                  className={`p-3 rounded-lg border-l-4 ${h.color} ${theme === 'dark' ? 'bg-stone-800/50' : 'bg-white'} shadow-sm border ${currentTheme.border} group cursor-pointer hover:scale-[1.02] transition`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] opacity-40 font-bold uppercase">Pág. {h.page}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setHighlights(prev => prev.filter(x => x.id !== h.id)); }}
                      className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90 line-clamp-3">"{h.text}"</p>
                  {h.comment && (
                    <div className={`mt-2 pt-2 border-t ${currentTheme.border} flex items-start gap-1.5`}>
                      <MessageSquare size={12} className="text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-[11px] opacity-60 italic line-clamp-2">{h.comment}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Main Content: PDF Reader */}
        <main 
          ref={containerRef}
          onMouseUp={handleMouseUp}
          className="flex-1 flex items-start justify-center p-8 overflow-auto relative scroll-smooth"
        >
          {!pdfDoc ? (
            <div className="flex flex-col items-center justify-center mt-20 opacity-40 max-w-sm text-center">
              <FileText size={64} strokeWidth={1} className="mb-4" />
              <h3 className="text-xl font-medium">Comece sua leitura</h3>
              <p className="mt-2 text-sm">Carregue um arquivo PDF para transformar em um livro de estudos interativo.</p>
            </div>
          ) : (
            <div className={`flex ${viewMode === 'double' ? 'flex-col md:flex-row gap-8' : 'flex-col gap-8'} items-center page-container`}>
              {/* Left/Main Page */}
              <div className="relative">
                <canvas ref={canvasRef1} className={`rounded-sm shadow-2xl ${currentTheme.canvasBg} transition-transform duration-300`} />
                {viewMode === 'double' && (
                  <>
                    <div className="absolute top-0 left-0 w-12 h-full bg-gradient-to-r from-black/5 to-transparent pointer-events-none" />
                    <div className="absolute -left-1 top-0 h-full w-1.5 bg-stone-500/10 blur-[1px]" />
                  </>
                )}
              </div>

              {/* Right Page (Only in Double Mode) */}
              {viewMode === 'double' && currentPage + 1 <= numPages && (
                <div className="relative hidden md:block">
                  <canvas ref={canvasRef2} className={`rounded-sm shadow-2xl ${currentTheme.canvasBg} transition-transform duration-300`} />
                  <div className="absolute top-0 right-0 w-12 h-full bg-gradient-to-l from-black/5 to-transparent pointer-events-none" />
                  <div className="absolute -right-1 top-0 h-full w-1.5 bg-stone-500/10 blur-[1px]" />
                </div>
              )}
            </div>
          )}

          {/* Floating Actions for Selection */}
          {selectedText && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white shadow-2xl rounded-full border border-stone-200 p-2 flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex gap-1 pr-3 border-r border-stone-100">
                {COLORS.map(c => (
                  <button
                    key={c.name}
                    onClick={() => addHighlight(c.bg)}
                    className={`w-6 h-6 rounded-full ${c.bg} border-2 border-white hover:scale-110 transition`}
                    title={`Marcar com ${c.name}`}
                  />
                ))}
              </div>
              <button 
                onClick={fetchDictionary}
                className="flex items-center gap-2 px-3 py-1.5 text-stone-600 hover:text-amber-600 transition text-sm font-medium"
              >
                <Search size={16} />
                Definição AI
              </button>
              <button 
                onClick={() => {
                  setActiveNote('');
                  setShowAnnotationModal(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-stone-600 hover:text-amber-600 transition text-sm font-medium"
              >
                <Plus size={16} />
                Anotação
              </button>
              <button 
                onClick={() => { setSelectedText(''); window.getSelection()?.removeAllRanges(); }}
                className="p-1.5 text-stone-300 hover:text-stone-500"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </main>

        {/* Right Sidebar: AI Dictionary & Active Insights */}
        <aside className={`w-80 ${currentTheme.sidebar} border-l ${currentTheme.border} p-6 flex flex-col gap-6 overflow-y-auto transition-colors duration-300`}>
          <div className="flex items-center gap-2 opacity-70 mb-2">
            <Search size={18} />
            <h2 className="text-sm font-bold uppercase tracking-wider">Significados</h2>
          </div>

          {isDictionaryLoading ? (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs opacity-50">Consultando o Gemini...</p>
            </div>
          ) : dictionaryResult ? (
            <div className={`${theme === 'dark' ? 'bg-stone-800' : 'bg-white'} p-5 rounded-2xl shadow-sm border ${currentTheme.border}`}>
              <h3 className="text-xl font-bold serif-font mb-1 capitalize">{dictionaryResult.word}</h3>
              <div className="h-0.5 w-12 bg-amber-500 mb-4 rounded-full" />
              
              <div className="mb-6">
                <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest block mb-2">Significado</span>
                <p className="text-sm leading-relaxed opacity-80 italic">
                  "{dictionaryResult.meaning}"
                </p>
              </div>

              {dictionaryResult.synonyms.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest block mb-2">Sinônimos</span>
                  <div className="flex flex-wrap gap-2">
                    {dictionaryResult.synonyms.map((s, idx) => (
                      <span key={idx} className="px-2 py-1 bg-amber-500/10 text-amber-600 text-[11px] font-medium rounded-md border border-amber-500/20">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <button 
                onClick={() => setDictionaryResult(null)}
                className="mt-6 w-full py-2 text-[11px] font-bold opacity-40 hover:opacity-100 transition flex items-center justify-center gap-1 border-t border-stone-500/10"
              >
                Limpar consulta
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
              <Search size={32} className="mb-2" />
              <p className="text-xs leading-relaxed">Selecione uma palavra no texto para ver significados e sinônimos.</p>
            </div>
          )}

          {/* Tips section */}
          <div className="mt-auto p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <h4 className="text-[10px] font-bold text-amber-600 uppercase mb-2">Dica de Estudo</h4>
            <p className="text-[11px] text-amber-600/80 leading-relaxed">
              O modo **Página Única** é ideal para foco total em telas verticais.
            </p>
          </div>
        </aside>
      </div>

      {/* Annotation Modal */}
      {showAnnotationModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className={`${theme === 'dark' ? 'bg-[#242424]' : 'bg-white'} rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95`}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Anotação</h3>
                <button onClick={closeAnnotationModal} className="opacity-40 hover:opacity-100">
                  <X size={20} />
                </button>
              </div>
              <div className={`${theme === 'dark' ? 'bg-stone-800' : 'bg-stone-50'} p-3 rounded-xl mb-4 border ${currentTheme.border}`}>
                <p className="text-xs opacity-60 italic line-clamp-2">"{selectedText}"</p>
              </div>
              <textarea
                value={activeNote}
                onChange={(e) => setActiveNote(e.target.value)}
                placeholder="Escreva seus pensamentos ou reflexões sobre este trecho..."
                className={`w-full h-40 p-4 ${theme === 'dark' ? 'bg-stone-800' : 'bg-stone-50'} rounded-2xl border-none focus:ring-2 focus:ring-amber-500 text-sm resize-none outline-none`}
                autoFocus
              />
            </div>
            <div className={`${theme === 'dark' ? 'bg-stone-800/50' : 'bg-stone-50'} p-4 px-6 flex justify-end gap-3`}>
              <button 
                onClick={closeAnnotationModal}
                className="px-4 py-2 text-sm font-medium opacity-60 hover:opacity-100"
              >
                Cancelar
              </button>
              <button 
                onClick={saveHighlight}
                disabled={!activeNote.trim()}
                className="px-6 py-2 bg-amber-600 text-white rounded-full text-sm font-bold shadow-lg shadow-amber-600/20 hover:bg-amber-700 disabled:opacity-50 transition"
              >
                {editingHighlightId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
