import { useState } from 'react';
import type { RecordedStep } from '../types';
import { StepItem } from './StepItem';

interface StepListProps {
  steps: RecordedStep[];
  onReorder: (steps: RecordedStep[]) => void;
  onDelete: (stepId: string) => void;
}

export function StepList({ steps, onReorder, onDelete }: StepListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSteps = [...steps];
    const draggedItem = newSteps[draggedIndex];
    newSteps.splice(draggedIndex, 1);
    newSteps.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    onReorder(newSteps);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (steps.length === 0) {
    return (
      <div className="flow-list-empty">
        <p>No steps in this flow.</p>
      </div>
    );
  }

  return (
    <div className="step-list">
      {steps.map((step, index) => (
        <StepItem
          key={step.id}
          step={step}
          index={index}
          isDragging={draggedIndex === index}
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          onDelete={() => onDelete(step.id)}
        />
      ))}
    </div>
  );
}
