import React, { useState, useEffect } from 'react';
import EnhancedNovelEditor from '../components/EnhancedNovelEditor';

const ProjectPage: React.FC = () => {
  const [projectDoc, setProjectDoc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Load project document
  const loadProjectDoc = async () => {
    try {
      console.log('Loading project document...');
      const doc = await window.api.getProjectDoc();
      setProjectDoc(doc || '# My Project\n\n## Ideas-Notes\n\n## Setting\n\n## Full Outline\n\n## Characters');
      setLastUpdated(new Date().toLocaleTimeString());
      console.log('Project document loaded successfully');
    } catch (error) {
      console.error('Failed to load project document:', error);
    }
  };

  // Force refresh project content by calling the sync database endpoint
  const forceRefresh = async () => {
    console.log('Force refreshing - calling sync database endpoint...');
    setIsLoading(true);
    setSyncStatus('Syncing from VM...');
    
    try {
      // Call the local webhook sync endpoint directly
      const syncResponse = await fetch('http://localhost:3001/sync-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (syncResponse.ok) {
        setSyncStatus('Database synced! Reloading content...');
        // Wait a moment for the sync to complete, then reload
        setTimeout(async () => {
          await loadProjectDoc();
          setSyncStatus('Content updated!');
          setTimeout(() => setSyncStatus(''), 2000);
          setIsLoading(false);
        }, 1000);
      } else {
        throw new Error(`Sync failed: ${syncResponse.status}`);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus('Sync failed - loading current content...');
      // Still try to reload current content
      try {
        await loadProjectDoc();
        setSyncStatus('Loaded current content (sync failed)');
        setTimeout(() => setSyncStatus(''), 3000);
      } catch (loadError) {
        setSyncStatus('Refresh failed completely');
        setTimeout(() => setSyncStatus(''), 3000);
      }
      setIsLoading(false);
    }
  };

  // Handle project document updates
  useEffect(() => {
    loadProjectDoc();

    // Listen for project document updates
    const handleProjectUpdate = (event: CustomEvent) => {
      console.log('Project update event received:', event.detail);
      loadProjectDoc();
    };

    // Listen for sync status changes
    const handleSyncStatus = (event: CustomEvent) => {
      const { status, message, success } = event.detail;
      
      if (status === 'started') {
        setIsLoading(true);
        setSyncStatus(message || 'Syncing...');
      } else if (status === 'completed') {
        setIsLoading(false);
        setSyncStatus(success ? 'Sync completed!' : message || 'Sync failed');
        
        // Auto-clear status after delay
        setTimeout(() => setSyncStatus(''), success ? 2000 : 5000);
        
        // Reload content after successful sync
        if (success) {
          setTimeout(() => loadProjectDoc(), 500);
        }
      }
    };

    // Listen for force refresh requests
    const handleForceRefresh = (event: CustomEvent) => {
      console.log('Force refresh requested:', event.detail);
      forceRefresh();
    };

    // Add event listeners
    window.addEventListener('project-doc-updated', handleProjectUpdate as EventListener);
    window.addEventListener('sync-status', handleSyncStatus as EventListener);
    window.addEventListener('force-refresh-project', handleForceRefresh as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('project-doc-updated', handleProjectUpdate as EventListener);
      window.removeEventListener('sync-status', handleSyncStatus as EventListener); 
      window.removeEventListener('force-refresh-project', handleForceRefresh as EventListener);
    };
  }, []);

  // Save project document
  const saveProjectDoc = async (content: string) => {
    try {
      // Save locally first
      await window.api.saveProjectDoc(content);
      setProjectDoc(content);
      

      
      // Trigger project update event for other components
      window.dispatchEvent(new CustomEvent('projectUpdated'));
    } catch (error) {
      console.error('Failed to save project document:', error);
      setSyncStatus('Save failed');
      setTimeout(() => setSyncStatus(''), 3000);
    }
  };

  // Handle editor changes
  const handleEditorChange = (content: string) => {
    console.log('Editor content changed, length:', content.length);
    setProjectDoc(content);
  };

  // Handle editor save
  const handleEditorSave = async (content: string) => {
    await saveProjectDoc(content);
  };

  // Push to VM manually
  const pushToVM = async () => {
    try {
      setSyncStatus('Pushing to VM...');
      setIsLoading(true);
      
      console.log('Pushing changes to VM database...');
      
      const response = await fetch('https://python-fastapi-u50080.vm.elestio.app/upload-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          markdown: projectDoc
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Successfully pushed to VM:', result);
        setSyncStatus('Pushed to VM successfully!');
        setTimeout(() => setSyncStatus(''), 2000);
      } else {
        throw new Error(`Push failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to push to VM:', error);
      setSyncStatus('Push to VM failed');
      setTimeout(() => setSyncStatus(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-auto bg-neutral-950 text-neutral-100">
      <div className="max-w-3xl mx-auto">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
            <div className="bg-neutral-800 rounded-lg p-6 text-center border border-neutral-700">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-neutral-200">{syncStatus}</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
              Project
              {isLoading && (
                <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-neutral-700 text-neutral-300">
                  Syncing...
                </span>
              )}
            </h1>
            <p className="text-neutral-400 text-sm">Manage your project overview and notes with inline editing</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={pushToVM}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              📤 Push to VM
            </button>
            <button
              onClick={forceRefresh}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              🔄 Pull from VM
            </button>
          </div>
        </div>

        {/* Sync Status Bar */}
        {syncStatus && !isLoading && (
          <div className="bg-blue-900 border-l-4 border-blue-400 p-3 mb-6 rounded-r-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-200">{syncStatus}</span>
              <span className="text-xs text-blue-300">Last updated: {lastUpdated}</span>
            </div>
          </div>
        )}

        {/* WYSIWYG Editor */}
        <EnhancedNovelEditor 
          initialMarkdown={projectDoc}
          onChange={handleEditorChange}
          onSave={handleEditorSave}
        />
      </div>
    </div>
  );
};

export default ProjectPage; 