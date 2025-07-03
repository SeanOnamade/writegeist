import React, { useState, useRef, useEffect } from 'react';
import { Lightbulb, Send, Clock, CheckCircle, XCircle, Zap } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';

interface SubmittedIdea {
  id: string;
  content: string;
  timestamp: Date;
  status: 'submitting' | 'processing' | 'completed' | 'error';
}

export const IdeaInbox: React.FC = () => {
  const [ideaText, setIdeaText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedIdeas, setSubmittedIdeas] = useState<SubmittedIdea[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [syncStatus, setSyncStatus] = useState<string>('');

  // No need to load recent ideas - we already track them in state

  // Submit new idea
  const submitIdea = async () => {
    if (!ideaText.trim() || isSubmitting) return;

    const newIdea: SubmittedIdea = {
      id: Date.now().toString(),
      content: ideaText.trim(),
      timestamp: new Date(),
      status: 'submitting'
    };

    setSubmittedIdeas(prev => [newIdea, ...prev]);
    setIsSubmitting(true);
    setSyncStatus('Submitting idea...');

    try {
      const response = await fetch('https://n8n-writegeist-u50080.vm.elestio.app/webhook/idea-inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idea: ideaText.trim(),
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setSubmittedIdeas(prev => 
          prev.map(idea => 
            idea.id === newIdea.id 
              ? { ...idea, status: 'processing' }
              : idea
          )
        );

        setSyncStatus('Idea submitted successfully! Processing...');
        setTimeout(() => setSyncStatus(''), 3000);
        
        // Clear the input field
        setIdeaText('');
        textareaRef.current?.focus();
      } else {
        setSyncStatus('Failed to submit idea. Please try again.');
        setTimeout(() => setSyncStatus(''), 3000);
      }
    } catch (error) {
      console.error('Failed to submit idea:', error);
      setSubmittedIdeas(prev => 
        prev.map(idea => 
          idea.id === newIdea.id 
            ? { ...idea, status: 'error' }
            : idea
        )
      );
      setSyncStatus('Failed to submit idea. Please try again.');
      setTimeout(() => setSyncStatus(''), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle sync status updates
  useEffect(() => {
    // Listen for sync status changes
    const handleSyncStatus = (event: CustomEvent) => {
      const { status, message, success } = event.detail;
      
      if (status === 'started') {
        setSyncStatus(message || 'Syncing...');
      } else if (status === 'completed') {
        setSyncStatus(success ? 'Sync completed!' : message || 'Sync failed');
        
        // Auto-clear status after delay
        setTimeout(() => setSyncStatus(''), success ? 2000 : 5000);
      }
    };

    // Listen for project updates
    const handleProjectUpdate = () => {
      // Project was updated, show notification
      setSyncStatus('Project updated successfully!');
      setTimeout(() => setSyncStatus(''), 2000);
    };

    // Add event listeners
    window.addEventListener('sync-status', handleSyncStatus as EventListener);
    window.addEventListener('project-doc-updated', handleProjectUpdate as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('sync-status', handleSyncStatus as EventListener);
      window.removeEventListener('project-doc-updated', handleProjectUpdate as EventListener);
    };
  }, []);

  const getStatusIcon = (status: SubmittedIdea['status']) => {
    switch (status) {
      case 'submitting': return <Send className="h-4 w-4" />;
      case 'processing': return <Zap className="h-4 w-4 animate-pulse" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: SubmittedIdea['status']) => {
    switch (status) {
      case 'submitting': return 'Submitting to AI...';
      case 'processing': return 'AI is organizing your idea...';
      case 'completed': return 'Added to your project!';
      case 'error': return 'Failed to submit';
      default: return 'Unknown';
    }
  };

  const getStatusColor = (status: SubmittedIdea['status']) => {
    switch (status) {
      case 'submitting': return 'text-blue-400';
      case 'processing': return 'text-yellow-400';
      case 'completed': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-neutral-400';
    }
  };

  return (
    <div className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Lightbulb className="h-6 w-6 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-neutral-100">Idea Inbox</h1>
            <p className="text-neutral-400 text-sm">Submit ideas and let AI organize them into your project</p>
          </div>
        </div>
        
        {/* Sync Status */}
        {syncStatus && (
          <div className="bg-blue-100 border-l-4 border-blue-500 p-3 mb-4">
            <span className="text-sm text-blue-700">{syncStatus}</span>
          </div>
        )}
        
        {/* Idea Submission Form */}
        <div className="bg-neutral-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-neutral-100 mb-4">Submit New Idea</h2>
          <div className="space-y-4">
            <Textarea
              ref={textareaRef}
              value={ideaText}
              onChange={(e) => setIdeaText(e.target.value)}
              placeholder="Describe your idea in under 20 words... e.g., 'What if Knox had a secret weakness to silver?' or 'The city should have floating districts connected by bridges'"
              className="min-h-[100px] resize-none bg-neutral-700 border-neutral-600 text-neutral-100 placeholder:text-neutral-400"
              disabled={isSubmitting}
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-400">
                🤖 AI will automatically organize this into the right section
              </span>
              <Button 
                onClick={submitIdea}
                disabled={!ideaText.trim() || isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Zap className="h-4 w-4 mr-2 animate-pulse" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Idea
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Recent Ideas */}
        {submittedIdeas.length > 0 && (
          <div className="bg-neutral-800 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-neutral-100 mb-4">Recent Ideas</h2>
            <div className="space-y-3">
              {submittedIdeas.map((idea) => (
                <div 
                  key={idea.id}
                  className="p-4 rounded-lg border border-neutral-600 bg-neutral-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-neutral-100 mb-2">{idea.content}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className={getStatusColor(idea.status)}>
                          {getStatusIcon(idea.status)}
                        </span>
                        <span className={getStatusColor(idea.status)}>
                          {getStatusText(idea.status)}
                        </span>
                        <span className="text-neutral-500">•</span>
                        <span className="text-neutral-400">
                          {idea.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it Works */}
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3 text-blue-300 flex items-center gap-2">
            <Zap className="h-5 w-5" />
            How AI Idea Processing Works
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-200">
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-semibold">1.</span>
              <div>
                <strong>Analyze:</strong> AI reads your idea and determines the best section (Characters, Setting, etc.)
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-semibold">2.</span>
              <div>
                <strong>Research:</strong> Fetches existing content from that section
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-semibold">3.</span>
              <div>
                <strong>Integrate:</strong> Merges your idea with existing content intelligently
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-400 font-semibold">4.</span>
              <div>
                <strong>Update:</strong> Adds the refined content to your project automatically
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-800/20 rounded border border-blue-600/30">
            <p className="text-xs text-blue-300">
              <strong>💡 Tip:</strong> After submitting an idea, check your project sections to see how AI has integrated it!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}; 