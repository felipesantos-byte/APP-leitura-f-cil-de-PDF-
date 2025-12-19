
export interface Highlight {
  id: string;
  page: number;
  text: string;
  color: string;
  comment?: string;
  rects: DOMRect[];
  timestamp: number;
}

export interface DictionaryResult {
  word: string;
  meaning: string;
  synonyms: string[];
}

export interface AppState {
  currentPdf: string | null;
  numPages: number;
  currentPage: number;
  highlights: Highlight[];
  selectedText: string;
  isDictionaryLoading: boolean;
  dictionaryResult: DictionaryResult | null;
}
