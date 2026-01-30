import type { RecordedStep } from '../types';

interface StepItemProps {
  step: RecordedStep;
  index: number;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDelete: () => void;
}

function getStepDescription(step: RecordedStep): string {
  switch (step.type) {
    case 'click':
      return `Click on ${step.target.tagName}${step.target.text ? ` "${step.target.text.substring(0, 30)}"` : ''}`;
    case 'input':
      return `Type "${step.value?.substring(0, 30) || ''}" into ${step.target.tagName}`;
    case 'select':
      return `Select "${step.value || ''}" in ${step.target.tagName}`;
    case 'scroll':
      return `Scroll to position (${step.scrollPosition?.x || 0}, ${step.scrollPosition?.y || 0})`;
    case 'keypress':
      return `Press ${step.value} key`;
    case 'navigation':
      return `Navigate to ${step.url?.substring(0, 50) || 'page'}`;
    case 'wait':
      return `Wait ${step.delay}ms`;
    default:
      return step.type;
  }
}

function getStepIcon(type: string): string {
  switch (type) {
    case 'click':
      return '👆';
    case 'input':
      return '⌨️';
    case 'select':
      return '📋';
    case 'scroll':
      return '📜';
    case 'keypress':
      return '⌨️';
    case 'navigation':
      return '🌐';
    case 'wait':
      return '⏱️';
    default:
      return '•';
  }
}

export function StepItem({
  step,
  index,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDelete,
}: StepItemProps) {
  return (
    <div
      className={`step-item ${isDragging ? 'dragging' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <span className="step-number">{index + 1}</span>
      <span style={{ fontSize: '18px' }}>{getStepIcon(step.type)}</span>
      <div className="step-info">
        <div className="step-type">{step.type}</div>
        <div className="step-details">{getStepDescription(step)}</div>
      </div>
      <div className="step-actions">
        <button
          className="btn btn-icon btn-danger"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('Delete this step?')) {
              onDelete();
            }
          }}
          title="Delete step"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
