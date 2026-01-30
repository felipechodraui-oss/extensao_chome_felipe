import type { Flow, ExportedFlow, ExportedFlowBundle } from '../types';
import { generateId } from './storage';

const EXPORT_VERSION = '1.0.0';

// Export a single flow as JSON file
export function exportFlow(flow: Flow): void {
  const exportData: ExportedFlow = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    flow,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(flow.name)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export all flows as a bundle
export function exportAllFlows(flows: Flow[]): void {
  const exportData: ExportedFlowBundle = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    flows,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flow-recorder-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import flow(s) from a JSON file
export function importFlow(file: File): Promise<Flow | Flow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Validate structure
        if (!data.version) {
          throw new Error('Invalid file format: missing version');
        }

        // Handle single flow
        if (data.flow) {
          const flow = validateAndPrepareFlow(data.flow);
          resolve(flow);
          return;
        }

        // Handle flow bundle
        if (data.flows && Array.isArray(data.flows)) {
          const flows = data.flows.map(validateAndPrepareFlow);
          resolve(flows);
          return;
        }

        throw new Error('Invalid file format: no flow data found');
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Validate and prepare a flow for import (assign new IDs)
function validateAndPrepareFlow(flow: unknown): Flow {
  if (!flow || typeof flow !== 'object') {
    throw new Error('Invalid flow data');
  }

  const f = flow as Record<string, unknown>;

  if (!f.name || !f.steps || !Array.isArray(f.steps)) {
    throw new Error('Invalid flow structure');
  }

  // Generate new IDs to avoid conflicts
  const newFlowId = generateId();
  const newSteps = (f.steps as unknown[]).map((step) => {
    if (!step || typeof step !== 'object') {
      throw new Error('Invalid step data');
    }
    return {
      ...(step as object),
      id: generateId(),
    };
  });

  return {
    ...(f as object),
    id: newFlowId,
    steps: newSteps,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as Flow;
}

// Sanitize filename for export
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .substring(0, 50) || 'flow';
}
