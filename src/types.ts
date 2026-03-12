export interface NodeData {
  id: string;
  x: number;
  y: number;
  label: string;
  color?: string;
  shape?: 'rect' | 'ellipse' | 'diamond';
  fontSize?: number;
  isRoot?: boolean;
  width?: number;
  height?: number;
  imageUrl?: string;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'top' | 'right' | 'bottom' | 'left';
  targetHandle?: 'top' | 'right' | 'bottom' | 'left';
  style?: 'solid' | 'dashed' | 'dotted';
  width?: number;
  label?: string;
  midpoint?: { x: number; y: number };
}

export type AppMode = 'select' | 'connect';

export interface HistoryState {
  nodes: NodeData[];
  edges: Edge[];
}
