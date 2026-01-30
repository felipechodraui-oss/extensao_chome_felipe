import type { Flow, StorageData } from '../types';

const DEFAULT_STORAGE: StorageData = {
  flows: [],
  settings: {
    defaultPlaybackSpeed: 1,
    highlightElements: true,
    stopOnError: true,
  },
};

// Get all data from storage
export async function getStorageData(): Promise<StorageData> {
  const data = await chrome.storage.local.get(['flows', 'settings']);
  return {
    flows: data.flows || DEFAULT_STORAGE.flows,
    settings: data.settings || DEFAULT_STORAGE.settings,
  };
}

// Save all flows
export async function saveFlows(flows: Flow[]): Promise<void> {
  await chrome.storage.local.set({ flows });
}

// Get all flows
export async function getFlows(): Promise<Flow[]> {
  const data = await getStorageData();
  return data.flows;
}

// Get a single flow by ID
export async function getFlow(flowId: string): Promise<Flow | undefined> {
  const flows = await getFlows();
  return flows.find((f) => f.id === flowId);
}

// Save a single flow (create or update)
export async function saveFlow(flow: Flow): Promise<void> {
  const flows = await getFlows();
  const existingIndex = flows.findIndex((f) => f.id === flow.id);

  if (existingIndex >= 0) {
    flows[existingIndex] = { ...flow, updatedAt: Date.now() };
  } else {
    flows.push(flow);
  }

  await saveFlows(flows);
}

// Delete a flow
export async function deleteFlow(flowId: string): Promise<void> {
  const flows = await getFlows();
  const filtered = flows.filter((f) => f.id !== flowId);
  await saveFlows(filtered);
}

// Update flow name
export async function renameFlow(flowId: string, newName: string): Promise<void> {
  const flows = await getFlows();
  const flow = flows.find((f) => f.id === flowId);
  if (flow) {
    flow.name = newName;
    flow.updatedAt = Date.now();
    await saveFlows(flows);
  }
}

// Get settings
export async function getSettings(): Promise<StorageData['settings']> {
  const data = await getStorageData();
  return data.settings;
}

// Save settings
export async function saveSettings(settings: StorageData['settings']): Promise<void> {
  await chrome.storage.local.set({ settings });
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Duplicate a flow
export async function duplicateFlow(flowId: string): Promise<Flow | null> {
  const flows = await getFlows();
  const flow = flows.find((f) => f.id === flowId);
  if (!flow) return null;

  const newFlow: Flow = {
    ...flow,
    id: generateId(),
    name: `${flow.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    steps: flow.steps.map((step) => ({
      ...step,
      id: generateId(),
    })),
  };

  await saveFlow(newFlow);
  return newFlow;
}
