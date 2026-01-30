// Element selector strategies for reliable element targeting
export interface ElementSelector {
  css: string;
  xpath: string;
  text?: string;
  tagName: string;
  attributes: Record<string, string>;
}

// Types of actions that can be recorded
export type StepType = 'click' | 'input' | 'scroll' | 'navigation' | 'keypress' | 'select' | 'wait';

// A single recorded step/action
export interface RecordedStep {
  id: string;
  type: StepType;
  timestamp: number;
  target: ElementSelector;
  value?: string;
  position?: { x: number; y: number };
  scrollPosition?: { x: number; y: number };
  url?: string;
  delay: number;
  description?: string;
}

// A complete recorded flow
export interface Flow {
  id: string;
  name: string;
  description?: string;
  steps: RecordedStep[];
  createdAt: number;
  updatedAt: number;
  startUrl: string;
}

// Playback configuration options
export interface PlaybackOptions {
  speed: number;
  stepByStep: boolean;
  stopOnError: boolean;
  highlightElements: boolean;
}

// Recording state
export interface RecordingState {
  isRecording: boolean;
  currentFlowId: string | null;
  steps: RecordedStep[];
  startUrl: string | null;
}

// Playback state
export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentFlowId: string | null;
  currentStepIndex: number;
  options: PlaybackOptions;
}

// Message types for communication between scripts
export type MessageType =
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'RECORD_STEP'
  | 'START_PLAYBACK'
  | 'STOP_PLAYBACK'
  | 'PAUSE_PLAYBACK'
  | 'RESUME_PLAYBACK'
  | 'SET_PLAYBACK_OPTIONS'
  | 'EXECUTE_STEP'
  | 'STEP_COMPLETED'
  | 'STEP_FAILED'
  | 'GET_STATE'
  | 'STATE_UPDATE';

export interface Message {
  type: MessageType;
  payload?: unknown;
}

// Storage structure
export interface StorageData {
  flows: Flow[];
  settings: {
    defaultPlaybackSpeed: number;
    highlightElements: boolean;
    stopOnError: boolean;
  };
}

// Export format for sharing flows
export interface ExportedFlow {
  version: string;
  exportedAt: number;
  flow: Flow;
}

export interface ExportedFlowBundle {
  version: string;
  exportedAt: number;
  flows: Flow[];
}
