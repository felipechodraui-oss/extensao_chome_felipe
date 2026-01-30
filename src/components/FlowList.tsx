import type { Flow } from '../types';

interface FlowListProps {
  flows: Flow[];
  onPlay: (flowId: string) => void;
  onEdit: (flowId: string) => void;
  onDelete: (flowId: string) => void;
  disabled?: boolean;
}

export function FlowList({ flows, onPlay, onEdit, onDelete, disabled }: FlowListProps) {
  if (flows.length === 0) {
    return (
      <div className="flow-list-empty">
        <p>No flows recorded yet.</p>
        <p>Click the record button to create your first flow.</p>
      </div>
    );
  }

  return (
    <div className="flow-list">
      {flows.map((flow) => (
        <div key={flow.id} className="flow-item">
          <div className="flow-info">
            <h3 className="flow-name">{flow.name}</h3>
            <p className="flow-meta">
              {flow.steps.length} steps • {new Date(flow.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flow-actions">
            <button
              className="btn btn-icon"
              onClick={() => onPlay(flow.id)}
              disabled={disabled}
              title="Play"
            >
              ▶
            </button>
            <button
              className="btn btn-icon"
              onClick={() => onEdit(flow.id)}
              disabled={disabled}
              title="Edit"
            >
              ✎
            </button>
            <button
              className="btn btn-icon btn-danger"
              onClick={() => {
                if (confirm(`Delete "${flow.name}"?`)) {
                  onDelete(flow.id);
                }
              }}
              disabled={disabled}
              title="Delete"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
