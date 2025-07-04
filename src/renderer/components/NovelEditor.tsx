import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Typography } from '@tiptap/extension-typography';

export interface NovelEditorProps {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
}

export default function NovelEditor({ initialMarkdown, onChange }: NovelEditorProps) {
  const editorRef = useRef<any>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const isInternalUpdate = useRef(false);

  // Count words in markdown text
  const countWords = (text: string): number => {
    if (!text) return 0;
    // Remove markdown formatting and count words
    const plainText = text
      .replace(/[#*>\-\[\]]/g, '') // Remove markdown symbols
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();
    if (!plainText) return 0;
    return plainText.split(/\s+/).filter(word => word.length > 0).length;
  };

  // Convert markdown to HTML - simple and reliable
  const markdownToHtml = (markdown: string): string => {
    if (!markdown) return '<p>Start writing... (Click ? for formatting help)</p>';
    
    // ULTRA SIMPLE conversion - just preserve structure
    const lines = markdown.split('\n');
    const htmlLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<br>';
      
      // Handle headings
      if (trimmed.startsWith('### ')) return `<h3>${trimmed.slice(4)}</h3>`;
      if (trimmed.startsWith('## ')) return `<h2>${trimmed.slice(3)}</h2>`;
      if (trimmed.startsWith('# ')) return `<h1>${trimmed.slice(2)}</h1>`;
      
      // Handle lists
      if (trimmed.startsWith('* ')) return `<li>${trimmed.slice(2)}</li>`;
      if (trimmed.startsWith('- ')) return `<li>${trimmed.slice(2)}</li>`;
      
      // Handle quotes
      if (trimmed.startsWith('> ')) return `<blockquote>${trimmed.slice(2)}</blockquote>`;
      
      // Handle horizontal rules
      if (trimmed === '---') return '<hr>';
      
      // Default paragraph
      return `<p>${trimmed}</p>`;
    });
    
    return htmlLines.join('') || '<p>Start writing... (Click ? for formatting help)</p>';
  };

  // Convert HTML back to markdown - ULTRA SIMPLE to avoid corruption
  const htmlToMarkdown = (html: string): string => {
    if (!html) return '';
    
    // ULTRA SIMPLE approach - just extract text and preserve basic structure
    let result = html
      // Handle basic formatting
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n') 
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '\n> $1\n')
      .replace(/<hr[^>]*>/gi, '\n---\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n* $1')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ''); // Remove all other HTML tags
    
    // Clean up excessive whitespace
    result = result
      .replace(/\n\s*\n\s*\n+/g, '\n\n') // Multiple blank lines to double
      .replace(/^\s+|\s+$/g, '') // Trim
      .trim();
    
    return result || '';
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Enable markdown shortcuts
        heading: {
          levels: [1, 2, 3],
        },
        // Fix list behavior
        bulletList: {},
        orderedList: {},
        listItem: {},
      }),
      Typography,
    ],
    content: markdownToHtml(initialMarkdown || ''),
    editorProps: {
      attributes: {
        class: 'writegeist-editor prose prose-invert max-w-3xl mx-auto focus:outline-none min-h-[500px] p-4',
      },
      // Fix backspace behavior with lists
      handleKeyDown: (view, event) => {
        if (event.key === 'Backspace') {
          const { state } = view;
          const { selection } = state;
          const { $from } = selection;
          
          // If we're at the start of a list item, lift it out instead of creating bullet
          if ($from.parent.type.name === 'listItem' && $from.parentOffset === 0) {
            return editor?.chain().liftListItem('listItem').run() || false;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      setWordCount(countWords(markdown));
      onChange(markdown);
    },
  });

  // Store editor reference and auto-focus
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
      // Auto-focus the editor when it's ready
      setTimeout(() => {
        editor.commands.focus();
      }, 100);
    }
  }, [editor]);

  // Update content when initialMarkdown changes (for external updates only)
  useEffect(() => {
    if (editor && initialMarkdown && !isInternalUpdate.current) {
      const currentHtml = editor.getHTML();
      const currentMarkdown = htmlToMarkdown(currentHtml);
      
      // Normalize both strings for comparison (remove extra whitespace)
      const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();
      const normalizedInitial = normalizeText(initialMarkdown);
      const normalizedCurrent = normalizeText(currentMarkdown);
      
      // Only update if the content is actually different
      if (normalizedInitial !== normalizedCurrent) {
        const html = markdownToHtml(initialMarkdown);
        editor.commands.setContent(html, false);
      }
    }
    // Update word count when initial markdown changes
    setWordCount(countWords(initialMarkdown || ''));
  }, [initialMarkdown, editor]);

  // Close help overlay when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showHelp && !(event.target as Element).closest('.help-overlay') && !(event.target as Element).closest('.help-button')) {
        setShowHelp(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHelp]);

  // Show loading state while editor initializes
  if (!editor) {
    return (
      <div className="relative">
        <div className="prose prose-invert max-w-3xl mx-auto focus:outline-none min-h-[500px] p-4 flex items-center justify-center">
          <div className="text-neutral-400">Loading editor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Custom styles to fix formatting issues */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .writegeist-editor h1,
          .writegeist-editor h2,
          .writegeist-editor h3 {
            margin-left: 0 !important;
            padding-left: 0 !important;
            text-indent: 0 !important;
            text-align: left !important;
          }
          
          .writegeist-editor p {
            margin-left: 0 !important;
            padding-left: 0 !important;
            text-indent: 0 !important;
            text-align: left !important;
          }
          
          .writegeist-editor blockquote {
            margin-left: 0 !important;
            padding-left: 1rem !important;
            text-align: left !important;
          }
        `
      }} />
      
      {/* Bubble Menu for formatting selected text */}
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="bg-neutral-800 border border-neutral-600 rounded-lg p-2 shadow-lg flex gap-1"
        >
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-2 py-1 rounded text-sm transition-all duration-200 hover:scale-105 ${
              editor.isActive('bold') ? 'bg-neutral-600 text-white' : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-2 py-1 rounded text-sm transition-all duration-200 hover:scale-105 ${
              editor.isActive('italic') ? 'bg-neutral-600 text-white' : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2 py-1 rounded text-sm transition-all duration-200 hover:scale-105 ${
              editor.isActive('heading', { level: 2 }) ? 'bg-neutral-600 text-white' : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2 py-1 rounded text-sm transition-all duration-200 hover:scale-105 ${
              editor.isActive('heading', { level: 3 }) ? 'bg-neutral-600 text-white' : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            H3
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`px-2 py-1 rounded text-sm transition-all duration-200 hover:scale-105 ${
              editor.isActive('blockquote') ? 'bg-neutral-600 text-white' : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            "&gt;"
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-2 py-1 rounded text-sm transition-all duration-200 hover:scale-105 ${
              editor.isActive('bulletList') ? 'bg-neutral-600 text-white' : 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
            }`}
          >
            •
          </button>
        </BubbleMenu>
      )}

      {/* Help Button */}
      <button
        onClick={() => setShowHelp(!showHelp)}
        className="help-button absolute top-2 right-2 z-10 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-md px-3 py-2 text-sm border border-neutral-600 transition-all duration-200 hover:scale-105 hover:shadow-lg"
        title="Formatting Help"
      >
        Formatting Guide
      </button>

      {/* Help Overlay */}
      {showHelp && (
        <div className="help-overlay absolute top-12 right-2 z-20 bg-neutral-900 border border-neutral-600 rounded-lg p-4 shadow-lg max-w-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-neutral-100 font-semibold">Formatting Guide</h3>
            <button
              onClick={() => setShowHelp(false)}
              className="text-neutral-400 hover:text-white transition-all duration-200 hover:scale-110 hover:rotate-90"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-3 text-sm">
            <div>
              <h4 className="text-neutral-200 font-medium mb-1">Live Markdown Shortcuts</h4>
              <div className="text-neutral-400 space-y-1">
                <div># Space → Large Header</div>
                <div>## Space → Medium Header</div>
                <div>### Space → Small Header</div>
                <div>**text** → Bold</div>
                <div>*text* → Italic</div>
                <div>&gt; Space → Blockquote</div>
                <div>--- → Horizontal Rule</div>
                <div>* Space → Bullet List</div>
                <div>1. Space → Numbered List</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-neutral-200 font-medium mb-1">Select Text + Bubble Menu</h4>
              <div className="text-neutral-400 space-y-1">
                <div>Select text to see formatting options</div>
                <div>Click buttons to apply formatting</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-neutral-200 font-medium mb-1">Keyboard Shortcuts</h4>
              <div className="text-neutral-400 space-y-1">
                <div>Ctrl+B → Bold</div>
                <div>Ctrl+I → Italic</div>
                <div>Ctrl+S → Save Now</div>
                <div>Enter twice → New paragraph</div>
              </div>
            </div>
            
            <div className="pt-2 border-t border-neutral-700">
              <div className="text-neutral-500 text-xs">
                Auto-saves every 30 seconds<br />
                Blue indicator = Saving in progress<br />
                Green indicator = Last saved time
              </div>
            </div>
          </div>
        </div>
      )}

      <EditorContent 
        editor={editor} 
        className="novel-editor-content"
      />
      
      {/* Word Count Display */}
      <div className="fixed bottom-4 left-4 text-xs text-neutral-500 bg-neutral-900/90 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg border border-neutral-700 z-30">
        {wordCount} {wordCount === 1 ? 'word' : 'words'}
      </div>
    </div>
  );
} 