import React from 'react';
import type { NodeData, Edge } from '../types';

export function getEdgePath(src: NodeData, tgt: NodeData, nodeSizes: Record<string, { w: number; h: number }>, sourceHandle?: 'top'|'right'|'bottom'|'left', targetHandle?: 'top'|'right'|'bottom'|'left', midpoint?: { x: number; y: number }) {
  const szSrc = nodeSizes[src.id] || { w: src.width || 160, h: src.height || 44 };
  const szTgt = nodeSizes[tgt.id] || { w: tgt.width || 160, h: tgt.height || 44 };

  const x1_c = src.x + szSrc.w / 2;
  const y1_c = src.y + szSrc.h / 2;
  const x2_c = tgt.x + szTgt.w / 2;
  const y2_c = tgt.y + szTgt.h / 2;

  const dx = x2_c - x1_c;
  const dy = y2_c - y1_c;

  // Determine actual handles (fallback to geometric relative position if not specified)
  let sHandle = sourceHandle;
  if (!sHandle) {
    if (Math.abs(dx) > Math.abs(dy)) sHandle = dx > 0 ? 'right' : 'left';
    else sHandle = dy > 0 ? 'bottom' : 'top';
  }

  let tHandle = targetHandle;
  if (!tHandle) {
    if (Math.abs(dx) > Math.abs(dy)) tHandle = dx > 0 ? 'left' : 'right';
    else tHandle = dy > 0 ? 'top' : 'bottom';
  }

  const overlap = 4;
  let x1 = x1_c, y1 = y1_c, x2 = x2_c, y2 = y2_c;

  switch (sHandle) {
    case 'top': y1 = src.y + overlap; break;
    case 'bottom': y1 = src.y + szSrc.h - overlap; break;
    case 'left': x1 = src.x + overlap; break;
    case 'right': x1 = src.x + szSrc.w - overlap; break;
  }

  switch (tHandle) {
    case 'top': y2 = tgt.y + overlap; break;
    case 'bottom': y2 = tgt.y + szTgt.h - overlap; break;
    case 'left': x2 = tgt.x + overlap; break;
    case 'right': x2 = tgt.x + szTgt.w - overlap; break;
  }

  const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  const cpOffset = Math.max(50, dist * 0.4);

  let cpx1 = x1, cpy1 = y1;
  let cpx2 = x2, cpy2 = y2;

  if (midpoint) {
    // If we have a manual midpoint, use it as a single quadratic control or 
    // split it for the cubic bezier. Let's use it as a common influence point.
    cpx1 = midpoint.x;
    cpy1 = midpoint.y;
    cpx2 = midpoint.x;
    cpy2 = midpoint.y;
  } else {
    switch (sHandle) {
      case 'top': cpy1 -= cpOffset; break;
      case 'bottom': cpy1 += cpOffset; break;
      case 'left': cpx1 -= cpOffset; break;
      case 'right': cpx1 += cpOffset; break;
    }

    switch (tHandle) {
      case 'top': cpy2 -= cpOffset; break;
      case 'bottom': cpy2 += cpOffset; break;
      case 'left': cpx2 -= cpOffset; break;
      case 'right': cpx2 += cpOffset; break;
    }
  }

  const path = `M ${x1} ${y1} C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${x2} ${y2}`;
  
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return { x1, y1, x2, y2, path, mx, my, cpx1, cpy1, cpx2, cpy2 };
}

interface ConnectionsProps {
  nodes: NodeData[];
  edges: Edge[];
  selectedEdgeId: string | null;
  previewLine?: { x1: number; y1: number; x2: number; y2: number } | null;
  nodeSizes: Record<string, { w: number; h: number }>;
  onEdgeHandleDown: (e: React.PointerEvent, edgeId: string, type: 'source' | 'target') => void;
  onEdgeMidpointDown: (e: React.PointerEvent, edgeId: string) => void;
  onDeleteEdge?: (id: string) => void;
}

export const Connections: React.FC<ConnectionsProps> = ({
  nodes,
  edges,
  selectedEdgeId,
  previewLine,
  nodeSizes,
  onEdgeHandleDown,
  onEdgeMidpointDown,
  onDeleteEdge,
}) => {
  const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        zIndex: 1,
      }}
    >
      <defs>
        {/* Neon purple glow */}
        <filter id="neon-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur1" />
          <feGaussianBlur stdDeviation="8" result="blur2" in="SourceGraphic" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Stronger selected glow */}
        <filter id="neon-glow-selected" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Gradient for unselected edges */}
        <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#A78BFA" stopOpacity="1" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.6" />
        </linearGradient>
        {/* Arrow markers */}
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,7 L10,3.5 Z" fill="#A78BFA" opacity="0.9" />
        </marker>
        <marker id="arrow-selected" markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,7 L10,3.5 Z" fill="#7C3AED" />
        </marker>
        <marker id="arrow-preview" markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,7 L10,3.5 Z" fill="#3B82F6" opacity="0.8" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) return null;

        const { path, mx, my, x1, y1, x2, y2, cpx2, cpy2 } = getEdgePath(src, tgt, nodeSizes, edge.sourceHandle, edge.targetHandle, edge.midpoint);
        const isSelected = selectedEdgeId === edge.id;
        const strokeWidth = edge.width ?? 2;
        const strokeDash = edge.style === 'dashed' ? '10,5'
          : edge.style === 'dotted' ? '2,5'
          : undefined;

        return (
          <g key={edge.id}>
            {/* Wide invisible hit area */}
            <path
              d={path}
              stroke="transparent"
              strokeWidth={20}
              fill="none"
              style={{ cursor: 'grab', pointerEvents: 'stroke' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onEdgeMidpointDown(e, edge.id);
              }}
              onMouseEnter={() => setHoveredEdgeId(edge.id)}
              onMouseLeave={() => setHoveredEdgeId(null)}
              className="edge-hit-area"
            />

            {/* Outer glow layer */}
            <path
              d={path}
              stroke={isSelected ? '#7C3AED' : 'rgba(124,58,237,0.7)'}
              strokeWidth={strokeWidth}
              fill="none"
              filter={isSelected ? 'url(#neon-glow-selected)' : 'url(#neon-glow)'}
              strokeDasharray={strokeDash}
              style={{ pointerEvents: 'none' }}
              className="edge-glow"
            />

            {/* Core line */}
            <path
              d={path}
              stroke={isSelected ? '#C4B5FD' : 'url(#edge-gradient)'}
              strokeWidth={isSelected ? strokeWidth + 1 : strokeWidth}
              fill="none"
              markerEnd={isSelected ? 'url(#arrow-selected)' : 'url(#arrow)'}
              strokeDasharray={strokeDash}
              strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
              className="edge-core"
            />



            {/* Inner bright center line (double-line neon effect) */}
            {!isSelected && (
              <path
                d={path}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={0.8}
                fill="none"
                strokeDasharray={strokeDash}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Edge label */}
            {edge.label && (
              <text
                x={mx}
                y={my - 8}
                textAnchor="middle"
                fill={isSelected ? '#C4B5FD' : '#A78BFA'}
                fontSize={11}
                fontFamily="inherit"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {edge.label}
              </text>
            )}

            {/* Re-connection handles when selected */}
            {isSelected && (
              <>
                <circle
                  cx={x1}
                  cy={y1}
                  r={6}
                  fill="#C4B5FD"
                  stroke="#7C3AED"
                  strokeWidth={2}
                  style={{ cursor: 'move', filter: 'drop-shadow(0 0 5px rgba(124,58,237,0.5))' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onEdgeHandleDown(e, edge.id, 'source');
                  }}
                />
                {/* Triangle handle at the tip (arrow head) */}
                {(() => {
                  const angle = Math.atan2(y2 - cpy2, x2 - cpx2) * 180 / Math.PI;
                  return (
                    <g transform={`translate(${x2},${y2}) rotate(${angle})`} className="edge-head-handle">
                      {/* Triangle hit area */}
                      <path
                        d="M -20,-15 L 10,0 L -20,15 Z"
                        fill="transparent"
                        style={{ cursor: 'move' }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onEdgeHandleDown(e, edge.id, 'target');
                        }}
                      />
                      {/* Visual triangle when selected */}
                      <path
                        d="M -10,-8 L 2,0 L -10,8 Z"
                        fill="#C4B5FD"
                        stroke="#7C3AED"
                        strokeWidth={1.5}
                        className="edge-head-visual"
                        style={{ pointerEvents: 'none', filter: 'drop-shadow(0 0 5px rgba(124,58,237,0.5))', transition: 'all 0.2s' }}
                      />
                    </g>
                  );
                })()}
                
                <circle
                  cx={edge.midpoint?.x ?? mx}
                  cy={edge.midpoint?.y ?? my}
                  r={5}
                  fill="#A78BFA"
                  stroke="#7C3AED"
                  strokeWidth={1.5}
                  style={{ cursor: 'move', filter: 'drop-shadow(0 0 5px rgba(124,58,237,0.3))' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onEdgeMidpointDown(e, edge.id);
                  }}
                />

                {/* Delete button at midpoint */}
                {onDeleteEdge && (isSelected || hoveredEdgeId === edge.id) && (
                  <g 
                    transform={`translate(${edge.midpoint?.x ?? mx}, ${edge.midpoint?.y ?? (my - 25)})`}
                    onClick={(e) => { e.stopPropagation(); onDeleteEdge(edge.id); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseEnter={() => setHoveredEdgeId(edge.id)}
                    onMouseLeave={() => setHoveredEdgeId(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle r="12" fill="#EF4444" stroke="white" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.6))' }} />
                    <path d="M -5,-5 L 5,5 M -5,5 L 5,-5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </g>
                )}
              </>
            )}

          </g>
        );
      })}

      {/* Preview line for connect mode */}
      {previewLine && (
        <g>
          {/* Glow */}
          <line
            x1={previewLine.x1} y1={previewLine.y1}
            x2={previewLine.x2} y2={previewLine.y2}
            stroke="rgba(59,130,246,0.3)"
            strokeWidth={6}
            style={{ pointerEvents: 'none' }}
          />
          {/* Core */}
          <line
            x1={previewLine.x1} y1={previewLine.y1}
            x2={previewLine.x2} y2={previewLine.y2}
            stroke="#3B82F6"
            strokeWidth={2}
            strokeDasharray="8,5"
            markerEnd="url(#arrow-preview)"
            strokeLinecap="round"
            style={{ pointerEvents: 'none' }}
          />
        </g>
      )}
    </svg>
  );
};
