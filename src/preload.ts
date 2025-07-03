// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

// Global save manager for keyboard shortcuts
let globalSaveHandler: (() => void) | null = null;

// Listen for database updates from main process and convert to project-doc-updated events
ipcRenderer.on('db-updated', (event, data) => {
  console.log('Database updated, triggering project refresh:', data);
  
  // Convert to project-doc-updated event for consistency
  window.dispatchEvent(new CustomEvent('project-doc-updated', {
    detail: { ...data, source: 'database-sync' }
  }));
  
  // Force immediate refresh if requested
  if (data.forceRefresh) {
    console.log('Force refresh requested - reloading project content');
    window.dispatchEvent(new CustomEvent('force-refresh-project', {
      detail: data
    }));
  }
});

// Listen for database connection management events
ipcRenderer.on('close-db-connections', () => {
  console.log('Received request to close database connections');
  // Trigger event to close any active database connections
  window.dispatchEvent(new CustomEvent('close-db-connections'));
});

ipcRenderer.on('reopen-db-connections', () => {
  console.log('Received request to reopen database connections');
  // Trigger event to reopen database connections
  window.dispatchEvent(new CustomEvent('reopen-db-connections'));
});

// Sync status events for loading states
ipcRenderer.on('sync-started', (event, data) => {
  console.log('Sync started:', data);
  window.dispatchEvent(new CustomEvent('sync-status', {
    detail: { status: 'started', ...data }
  }));
});

ipcRenderer.on('sync-completed', (event, data) => {
  console.log('Sync completed:', data);
  window.dispatchEvent(new CustomEvent('sync-status', {
    detail: { status: 'completed', ...data }
  }));
  
  // Force refresh if needed
  if (data.forceRefresh) {
    console.log('Forcing project refresh after sync');
    window.dispatchEvent(new CustomEvent('force-refresh-project', {
      detail: data
    }));
  }
});

// Global keyboard handler for Ctrl/Cmd+S
window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    event.stopPropagation();
    
    if (globalSaveHandler) {
      globalSaveHandler();
    }
  }
}, { capture: true });

contextBridge.exposeInMainWorld('api', {
  echo: async (text: string) => {
    const res = await fetch('http://127.0.0.1:8000/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return (await res.json()).echo as string;
  },
  ingestChapter: async (payload: { title: string; text: string }) => {
    const res = await fetch('http://127.0.0.1:8000/ingest_chapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  },
  saveChapterToDB: async (chapter: any) => {
    return await ipcRenderer.invoke('save-chapter', chapter);
  },
  getChapters: async () => {
    return await ipcRenderer.invoke('get-chapters');
  },
  deleteChapter: async (id: string) => {
    return await ipcRenderer.invoke('delete-chapter', id);
  },
  getProjectDoc: async () => {
    return await ipcRenderer.invoke('get-project-doc');
  },
  saveProjectDoc: async (markdown: string) => {
    return await ipcRenderer.invoke('save-project-doc', markdown);
  },
  appendCharacters: async (chars: string[]) => {
    return await ipcRenderer.invoke('append-characters', chars);
  },
  updateChapter: async (chapter: any) => {
    return await ipcRenderer.invoke('update-chapter', chapter);
  },
  syncChapterDynamic: async (result: any) => {
    return await ipcRenderer.invoke('sync-chapter-dynamic', result);
  },
  getConfig: async () => {
    return await ipcRenderer.invoke('get-config');
  },
  saveConfig: async (config: any) => {
    return await ipcRenderer.invoke('save-config', config);
  },
  registerGlobalSaveHandler: (handler: () => void) => {
    globalSaveHandler = handler;
  },
  unregisterGlobalSaveHandler: () => {
    globalSaveHandler = null;
  },
  syncToVM: async () => {
    return await ipcRenderer.invoke('sync-to-vm');
  },
  syncFromVM: async () => {
    return await ipcRenderer.invoke('sync-from-vm');
  },
});
