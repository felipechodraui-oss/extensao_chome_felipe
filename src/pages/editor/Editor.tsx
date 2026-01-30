import { useState, useEffect } from 'react';
import type { Flow, RecordedStep } from '../../types';
import { getFlows, saveFlow, deleteFlow, duplicateFlow, generateId } from '../../utils/storage';
import { exportFlow, exportAllFlows, importFlow } from '../../utils/export';
import { StepList } from '../../components/StepList';
import { PlaybackControls } from '../../components/PlaybackControls';

export function Editor() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [flowName, setFlowName] = useState('');
  const [loading, setLoading] = useState(true);

  // Get flowId from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const initialFlowId = urlParams.get('flowId');

  // Load flows on mount
  useEffect(() => {
    const loadFlows = async () => {
      try {
        const savedFlows = await getFlows();
        setFlows(savedFlows);

        if (initialFlowId) {
          const flow = savedFlows.find((f) => f.id === initialFlowId);
          if (flow) {
            setSelectedFlow(flow);
            setFlowName(flow.name);
          }
        }
      } catch (error) {
        console.error('Failed to load flows:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFlows();
  }, [initialFlowId]);

  // Handle flow selection
  const handleSelectFlow = (flowId: string) => {
    const flow = flows.find((f) => f.id === flowId);
    if (flow) {
      setSelectedFlow(flow);
      setFlowName(flow.name);
      window.history.replaceState(null, '', `?flowId=${flowId}`);
    }
  };

  // Handle name change
  const handleNameChange = async () => {
    if (!selectedFlow || flowName === selectedFlow.name) return;

    const updatedFlow = { ...selectedFlow, name: flowName };
    await saveFlow(updatedFlow);
    setSelectedFlow(updatedFlow);
    setFlows((prev) => prev.map((f) => (f.id === updatedFlow.id ? updatedFlow : f)));
  };

  // Handle step reorder
  const handleReorderSteps = async (newSteps: RecordedStep[]) => {
    if (!selectedFlow) return;

    const updatedFlow = { ...selectedFlow, steps: newSteps };
    await saveFlow(updatedFlow);
    setSelectedFlow(updatedFlow);
    setFlows((prev) => prev.map((f) => (f.id === updatedFlow.id ? updatedFlow : f)));
  };

  // Handle step delete
  const handleDeleteStep = async (stepId: string) => {
    if (!selectedFlow) return;

    const newSteps = selectedFlow.steps.filter((s) => s.id !== stepId);
    const updatedFlow = { ...selectedFlow, steps: newSteps };
    await saveFlow(updatedFlow);
    setSelectedFlow(updatedFlow);
    setFlows((prev) => prev.map((f) => (f.id === updatedFlow.id ? updatedFlow : f)));
  };

  // Handle flow delete
  const handleDeleteFlow = async () => {
    if (!selectedFlow) return;
    if (!confirm(`Delete "${selectedFlow.name}"? This cannot be undone.`)) return;

    await deleteFlow(selectedFlow.id);
    setFlows((prev) => prev.filter((f) => f.id !== selectedFlow.id));
    setSelectedFlow(null);
    setFlowName('');
    window.history.replaceState(null, '', window.location.pathname);
  };

  // Handle flow duplicate
  const handleDuplicateFlow = async () => {
    if (!selectedFlow) return;

    const newFlow = await duplicateFlow(selectedFlow.id);
    if (newFlow) {
      setFlows((prev) => [newFlow, ...prev]);
      setSelectedFlow(newFlow);
      setFlowName(newFlow.name);
      window.history.replaceState(null, '', `?flowId=${newFlow.id}`);
    }
  };

  // Add a wait step
  const handleAddWaitStep = async () => {
    if (!selectedFlow) return;

    const delayMs = prompt('Enter wait time in milliseconds:', '1000');
    if (!delayMs) return;

    const delay = parseInt(delayMs, 10);
    if (isNaN(delay) || delay <= 0) {
      alert('Please enter a valid positive number');
      return;
    }

    const waitStep: RecordedStep = {
      id: generateId(),
      type: 'wait',
      timestamp: Date.now(),
      delay,
      target: {
        css: '',
        xpath: '',
        tagName: 'wait',
        attributes: {},
      },
    };

    const newSteps = [...selectedFlow.steps, waitStep];
    const updatedFlow = { ...selectedFlow, steps: newSteps };
    await saveFlow(updatedFlow);
    setSelectedFlow(updatedFlow);
    setFlows((prev) => prev.map((f) => (f.id === updatedFlow.id ? updatedFlow : f)));
  };

  // Handle export
  const handleExport = () => {
    if (selectedFlow) {
      exportFlow(selectedFlow);
    }
  };

  // Handle export all
  const handleExportAll = () => {
    exportAllFlows(flows);
  };

  // Handle import
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const imported = await importFlow(file);
        if (Array.isArray(imported)) {
          for (const flow of imported) {
            await saveFlow(flow);
          }
          setFlows((prev) => [...imported, ...prev]);
        } else {
          await saveFlow(imported);
          setFlows((prev) => [imported, ...prev]);
        }
        alert('Import successful!');
      } catch (error) {
        alert('Import failed: ' + (error as Error).message);
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="editor">
        <div className="loading" style={{ height: '100vh' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="editor">
      <header className="editor-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '600' }}>Flow Editor</h1>
          <select
            value={selectedFlow?.id || ''}
            onChange={(e) => handleSelectFlow(e.target.value)}
            className="input"
            style={{ minWidth: '200px' }}
          >
            <option value="">Select a flow...</option>
            {flows.map((flow) => (
              <option key={flow.id} value={flow.id}>
                {flow.name} ({flow.steps.length} steps)
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleImport}>
            Import
          </button>
          <button className="btn btn-secondary" onClick={handleExportAll} disabled={flows.length === 0}>
            Export All
          </button>
        </div>
      </header>

      <div className="editor-content">
        {!selectedFlow ? (
          <div className="editor-empty">
            <h2>No flow selected</h2>
            <p>Select a flow from the dropdown above, or import a flow file.</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  onBlur={handleNameChange}
                  className="input"
                  style={{ flex: 1, fontSize: '18px', fontWeight: '500' }}
                />
                <button className="btn btn-secondary" onClick={handleDuplicateFlow}>
                  Duplicate
                </button>
                <button className="btn btn-primary" onClick={handleExport}>
                  Export
                </button>
                <button className="btn btn-danger" onClick={handleDeleteFlow}>
                  Delete
                </button>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Start URL: {selectedFlow.startUrl}
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Created: {new Date(selectedFlow.createdAt).toLocaleString()}
              </p>
            </div>

            <PlaybackControls flowId={selectedFlow.id} />

            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '600' }}>
                  Steps ({selectedFlow.steps.length})
                </h2>
                <button className="btn btn-secondary btn-small" onClick={handleAddWaitStep}>
                  + Add Wait Step
                </button>
              </div>
              <StepList
                steps={selectedFlow.steps}
                onReorder={handleReorderSteps}
                onDelete={handleDeleteStep}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
