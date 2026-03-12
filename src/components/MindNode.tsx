import React, { useRef, useEffect, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { NodeData } from '../types';
import './MindNode.css';

const RESIZE_DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;

// A fully uncontrolled editor that NEVER re-renders. 
// This completely prevents React from resetting the text/cursor during active typing.
const UncontrolledEditor = React.memo<{
  initialContent: string;
  onSave: (content: string) => void;
  onPointerDown: (e: React.PointerEvent) => void;
}>(
  ({ initialContent, onSave, onPointerDown }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (ref.current) {
        ref.current.innerText = initialContent;
        ref.current.focus();
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, [initialContent]); // Runs only once upon mounting the editor

    return (
      <div
        ref={ref}
        className="mind-node-content"
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onSave(e.currentTarget.innerText || '')}
        onPointerDown={onPointerDown}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            onSave(e.currentTarget.innerText || '');
            window.getSelection()?.removeAllRanges();
          }
        }}
      />
    );
  },
  () => true // Never re-render!
);

interface MindNodeProps {
  node: NodeData;
  isSelected: boolean;
  isConnectSource?: boolean;
  isResizing?: boolean;
  mode?: 'select' | 'connect';
  autoFocus?: boolean;
  isHovered?: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onConnectPortDown: (e: React.PointerEvent, id: string, handle: 'top'|'right'|'bottom'|'left') => void;
  onLabelChange: (id: string, label: string) => void;
  onSizeUpdate: (id: string, w: number, h: number) => void;
  onResizeStart: (id: string, dir: string, clientX: number, clientY: number) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const MindNode: React.FC<MindNodeProps> = ({
  node,
  isSelected,
  isConnectSource,
  isResizing,
  mode,
  autoFocus,
  isHovered,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onConnectPortDown,
  onLabelChange,
  onSizeUpdate,
  onResizeStart,
  onMouseEnter,
  onMouseLeave,
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(node.label);

  // Sync content from external changes only when not actively editing
  useEffect(() => {
    if (!isEditing) {
      setEditContent(node.label);
    }
  }, [node.label, isEditing]);

  // Auto-focus new nodes defaults to edit mode
  useEffect(() => {
    if (autoFocus) {
      setIsEditing(true);
    }
  }, [autoFocus]);

  // Exit edit mode if clicking elsewhere
  useEffect(() => {
    if (!isSelected) {
      setIsEditing(false);
    }
  }, [isSelected]);

  // Measure rendered size and report up — used for connect port positioning
  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      onSizeUpdate(node.id, el.offsetWidth, el.offsetHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [node.id, onSizeUpdate]);

  const nodeStyle: React.CSSProperties = {
    transform: `translate(${node.x}px, ${node.y}px)`,
    fontSize: node.fontSize ? `${node.fontSize}px` : undefined,
    ...(node.width  != null && { width: node.width,  minWidth: node.width,  maxWidth: node.width }),
    ...(node.height != null && { height: node.height, minHeight: node.height }),
  };

  const isDiamond = node.shape === 'diamond';

  if (node.color) {
    (nodeStyle as any)['--node-color'] = node.color;
    (nodeStyle as any)['--diamond-stroke'] = node.color;
    if (!isDiamond) {
      nodeStyle.borderColor = node.color;
    }
  }

  const shapeClass = node.shape === 'ellipse' ? 'shape-ellipse'
    : node.shape === 'diamond' ? 'shape-diamond'
    : '';

  const isConnectMode = mode === 'connect';

  return (
    <div
      ref={nodeRef}
      className={[
        'mind-node',
        shapeClass,
        isSelected ? 'selected' : '',
        isConnectSource ? 'connect-source' : '',
        isConnectMode ? 'connect-mode' : '',
        'glow-effect',
      ].filter(Boolean).join(' ')}
      style={nodeStyle}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown(e, node.id);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Diamond SVG Background */}
      {isDiamond && (
        <svg
          className="diamond-svg-bg"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <polygon points="50,0 100,50 50,100 0,50" />
        </svg>
      )}


      {/* Resize handles — only when selected, not during active resize, not for diamond */}
      {isSelected && !isResizing && (
        <>
          {RESIZE_DIRS.map((dir) => (
            <div
              key={dir}
              className={`resize-handle resize-handle-${dir}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onResizeStart(node.id, dir, e.clientX, e.clientY);
              }}
            />
          ))}
        </>
      )}

      {/* Connect ports — 4 directional edges */}
      {isHovered && !isResizing && mode !== 'connect' && (
        <>
          <div className="connect-port port-top"
            style={{ left: '50%', top: 0 }}
            onPointerDown={(e) => { e.stopPropagation(); onConnectPortDown(e, node.id, 'top'); }} />
          <div className="connect-port port-right"
            style={{ left: '100%', top: '50%' }}
            onPointerDown={(e) => { e.stopPropagation(); onConnectPortDown(e, node.id, 'right'); }} />
          <div className="connect-port port-bottom"
            style={{ left: '50%', top: '100%' }}
            onPointerDown={(e) => { e.stopPropagation(); onConnectPortDown(e, node.id, 'bottom'); }} />
          <div className="connect-port port-left"
            style={{ left: 0, top: '50%' }}
            onPointerDown={(e) => { e.stopPropagation(); onConnectPortDown(e, node.id, 'left'); }} />
        </>
      )}

      {/* Node Image */}
      {node.imageUrl && (
        <img
          src={node.imageUrl}
          alt="node content"
          className="mind-node-image"
          draggable={false}
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDown(e, node.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        />
      )}

      {/* Node label */}
      {isEditing ? (
        <UncontrolledEditor
          initialContent={editContent}
          onSave={(text) => {
            setIsEditing(false);
            onLabelChange(node.id, text);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDown(e, node.id);
          }}
        />
      ) : (
        <div
          className="mind-node-content markdown-body"
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsEditing(true);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDown(e, node.id);
          }}
          dangerouslySetInnerHTML={{
             __html: DOMPurify.sanitize(marked.parse(node.label || '', { async: false }) as string),
          }}
        />
      )}
    </div>
  );
};
