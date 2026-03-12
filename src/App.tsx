import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import './App.css';
import { InfiniteCanvas } from './components/InfiniteCanvas';
import type { CanvasHandle } from './components/InfiniteCanvas';
import { MindNode } from './components/MindNode';
import { NodeToolbar } from './components/NodeToolbar';
import { Connections } from './components/Connections';
import { Toolbar } from './components/Toolbar';
import { HelpModal } from './components/HelpModal';
import { ContextMenu } from './components/ContextMenu';
import { useHistory } from './hooks/useHistory';
import type { NodeData, Edge, AppMode } from './types';
import logoImg from './assets/logo.png';

let nextId = 6;
function genId() { return String(nextId++); }

const INITIAL_NODES: NodeData[] = [
  { id: '1', x: 400, y: 280, label: 'Conceito Central', isRoot: true, fontSize: 16 },
  { id: '2', x: 160, y: 460, label: 'UI Guidelines' },
  { id: '3', x: 640, y: 460, label: 'Tech Stack' },
  { id: '4', x: 60,  y: 640, label: 'Dark Mode' },
  { id: '5', x: 280, y: 640, label: 'Glow Effects' },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: '1', target: '2' },
  { id: 'e2', source: '1', target: '3' },
  { id: 'e3', source: '2', target: '4' },
  { id: 'e4', source: '2', target: '5' },
];

function App() {
  const canvasRef = useRef<CanvasHandle>(null);
  const [scale, setScaleDisplay] = useState(1);

  const { current, push, undo, redo, canUndo, canRedo } = useHistory({
    nodes: INITIAL_NODES,
    edges: INITIAL_EDGES,
  });

  const nodes = current.nodes;
  const edges = current.edges;

  // Stable refs for use inside event handlers
  const nodesRef = useRef<NodeData[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // Selection
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [newNodeId, setNewNodeId] = useState<string | null>(null);

  // Interaction mode
  const [mode, setMode] = useState<AppMode>('select');
  const modeRef = useRef<AppMode>('select');
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const connectSourceRef = useRef<string | null>(null);
  const [previewLine, setPreviewLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const [showHelp, setShowHelp] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);

  // Drag — live override (state for render, ref for commit in pointer-up)
  const dragInfo = useRef<{ startX: number; startY: number } | null>(null);
  const [dragDelta, setDragDelta] = useState<{ dx: number; dy: number } | null>(null);
  const dragDeltaRef = useRef<{ dx: number; dy: number } | null>(null);

  // Live edge override for real-time manipulation without history bloat
  const [liveEdgeOverride, setLiveEdgeOverride] = useState<Edge[] | null>(null);
  const liveEdgeOverrideRef = useRef<Edge[] | null>(null);
  useEffect(() => { liveEdgeOverrideRef.current = liveEdgeOverride; }, [liveEdgeOverride]);

  const [tempDragNode, setTempDragNode] = useState<NodeData | null>(null);

  // Hover for connect port
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const portDragSourceRef = useRef<string | null>(null);
  const portDragHandleRef = useRef<'top' | 'right' | 'bottom' | 'left' | null>(null);

  // Edge drag re-connection
  const edgeDragInfo = useRef<{
    edgeId: string;
    type: 'source' | 'target';
  } | null>(null);

  // Node sizes — measured by ResizeObserver in MindNode, NOT stored in history
  const [nodeSizes, setNodeSizes] = useState<Record<string, { w: number; h: number }>>({});
  const nodeSizesRef = useRef<Record<string, { w: number; h: number }>>({});
  useEffect(() => { nodeSizesRef.current = nodeSizes; }, [nodeSizes]);

  // Resize — live override (state for render, ref for handlers)
  const resizeInfo = useRef<{
    id: string; dir: string;
    startClientX: number; startClientY: number;
    origX: number; origY: number; origW: number; origH: number;
  } | null>(null);
  const [resizeOverride, setResizeOverride] = useState<{
    id: string; x: number; y: number; w: number; h: number;
  } | null>(null);
  const resizeOverrideRef = useRef<{ id: string; x: number; y: number; w: number; h: number } | null>(null);

  // ─── Sync mode/connectSource refs ────────────────────────────────────────
  const updateMode = useCallback((m: AppMode) => {
    modeRef.current = m;
    setMode(m);
  }, []);
  const updateConnectSource = useCallback((s: string | null) => {
    connectSourceRef.current = s;
    setConnectSource(s);
  }, []);

  // ─── Node Operations ────────────────────────────────────────────────────
  const addNode = useCallback((x: number, y: number, label = '') => {
    const id = genId();
    const newNode: NodeData = { id, x: x - 70, y: y - 20, label };
    push({ nodes: [...nodesRef.current, newNode], edges: edgesRef.current });
    setSelectedNodeIds([id]);
    setSelectedEdgeId(null);
    setNewNodeId(id);
    setTimeout(() => setNewNodeId(null), 300);
  }, [push]);

  const addNodeCenter = useCallback(() => {
    const pos = canvasRef.current?.getPosition() ?? { x: 0, y: 0 };
    const sc = canvasRef.current?.getScale() ?? 1;
    const cx = (window.innerWidth / 2 - pos.x) / sc;
    const cy = (window.innerHeight / 2 - pos.y) / sc;
    addNode(cx, cy);
  }, [addNode]);

  // ─── Image Pasting ──────────────────────────────────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            if (typeof event.target?.result === 'string') {
               const pos = canvasRef.current?.getPosition() ?? { x: 0, y: 0 };
               const sc = canvasRef.current?.getScale() ?? 1;
               const cx = (window.innerWidth / 2 - pos.x) / sc;
               const cy = (window.innerHeight / 2 - pos.y) / sc;
               
               const id = genId();
               const newNode: NodeData = { 
                 id, 
                 x: cx - 100, 
                 y: cy - 100, 
                 label: '',
                 imageUrl: event.target.result,
                 width: 300
               };
               push({ nodes: [...nodesRef.current, newNode], edges: edgesRef.current });
               setSelectedNodeIds([id]);
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [push]);

  const deleteSelected = useCallback(() => {
    const eId = selectedEdgeId;
    if (selectedNodeIds.length > 0) {
      const remainingNodes = nodesRef.current.filter(n => !selectedNodeIds.includes(n.id) || n.isRoot);
      const remainingEdges = edgesRef.current.filter(e => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target));
      push({
        nodes: remainingNodes,
        edges: remainingEdges,
      });
      setSelectedNodeIds([]);
    } else if (eId) {
      push({
        nodes: nodesRef.current,
        edges: edgesRef.current.filter(e => e.id !== eId),
      });
      setSelectedEdgeId(null);
    }
  }, [selectedNodeIds, selectedEdgeId, push]);

  const duplicateNode = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const newNodes: NodeData[] = [];
    selectedNodeIds.forEach(nId => {
      const src = nodesRef.current.find(n => n.id === nId);
      if (src && !src.isRoot) {
        newNodes.push({ ...src, id: genId(), x: src.x + 40, y: src.y + 40 });
      }
    });
    if (newNodes.length === 0) return;
    push({ nodes: [...nodesRef.current, ...newNodes], edges: edgesRef.current });
    setSelectedNodeIds(newNodes.map(n => n.id));
  }, [selectedNodeIds, push]);

  const handleNodePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (modeRef.current === 'connect') {
      if (!connectSourceRef.current) {
        updateConnectSource(id);
        setSelectedNodeIds([id]);
      } else if (connectSourceRef.current !== id) {
        const src = connectSourceRef.current;
        const exists = edgesRef.current.some(
          edge => (edge.source === src && edge.target === id) ||
                  (edge.source === id && edge.target === src)
        );
        if (!exists) {
          const sNode = nodesRef.current.find(n => n.id === src);
          const tNode = nodesRef.current.find(n => n.id === id);
          let sHandle: 'top'|'right'|'bottom'|'left' = 'right';
          let tHandle: 'top'|'right'|'bottom'|'left' = 'left';
          if (sNode && tNode) {
            const dx = tNode.x - sNode.x;
            const dy = tNode.y - sNode.y;
            if (Math.abs(dx) > Math.abs(dy)) {
              sHandle = dx > 0 ? 'right' : 'left';
              tHandle = dx > 0 ? 'left' : 'right';
            } else {
              sHandle = dy > 0 ? 'bottom' : 'top';
              tHandle = dy > 0 ? 'top' : 'bottom';
            }
          }
          const newEdge: Edge = { id: genId(), source: src, target: id, sourceHandle: sHandle, targetHandle: tHandle };
          push({ nodes: nodesRef.current, edges: [...edgesRef.current, newEdge] });
        }
        updateConnectSource(null);
        setPreviewLine(null);
        updateMode('select');
      }
      return;
    }

    if (!selectedNodeIds.includes(id)) {
      setSelectedNodeIds([id]);
    }
    setSelectedEdgeId(null);
    setDragDelta(null);
    dragDeltaRef.current = null;
    dragInfo.current = { startX: e.clientX, startY: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [selectedNodeIds, push, updateConnectSource, updateMode]);

  const handleNodePointerMove = useCallback((e: React.PointerEvent, currentScale: number) => {
    if (!dragInfo.current || selectedNodeIds.length === 0) return;
    const dx = (e.clientX - dragInfo.current.startX) / currentScale;
    const dy = (e.clientY - dragInfo.current.startY) / currentScale;

    dragDeltaRef.current = { dx, dy };
    setDragDelta({ dx, dy });
  }, [selectedNodeIds]);

  const handleNodePointerUp = useCallback(() => {
    const delta = dragDeltaRef.current;
    if (delta && selectedNodeIds.length > 0) {
      push({
        nodes: nodesRef.current.map(n =>
          selectedNodeIds.includes(n.id) ? { ...n, x: n.x + delta.dx, y: n.y + delta.dy } : n
        ),
        edges: edgesRef.current,
      });
      dragDeltaRef.current = null;
      setDragDelta(null);
    }
    dragInfo.current = null;
  }, [selectedNodeIds, push]);

  // Handle connect mode preview line
  useEffect(() => {
    if (mode !== 'connect' || !connectSource) {
      setPreviewLine(null);
      return;
    }

    const onMove = (e: MouseEvent) => {
      const src = nodesRef.current.find(n => n.id === connectSource);
      if (!src) return;
      const pos = canvasRef.current?.getPosition() ?? { x: 0, y: 0 };
      const sc = canvasRef.current?.getScale() ?? 1;
      const canvasX = (e.clientX - pos.x) / sc;
      const canvasY = (e.clientY - pos.y) / sc;
      const sz = nodeSizesRef.current[src.id];
      setPreviewLine({
        x1: src.x + (sz?.w ?? 155),
        y1: src.y + (sz?.h ?? 44) / 2,
        x2: canvasX,
        y2: canvasY,
      });
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [mode, connectSource]);
  // ─── Edge Handle manipulation ─────────────────────────────────────────────
  const handleEdgeHandleDown = useCallback((e: React.PointerEvent, edgeId: string, type: 'source' | 'target') => {
    e.preventDefault();
    e.stopPropagation();
    edgeDragInfo.current = { edgeId, type };

    const toCanvas = (clientX: number, clientY: number) => {
      const pos = canvasRef.current?.getPosition() ?? { x: 0, y: 0 };
      const sc = canvasRef.current?.getScale() ?? 1;
      return { x: (clientX - pos.x) / sc, y: (clientY - pos.y) / sc };
    };

    const edge = edgesRef.current.find(ed => ed.id === edgeId);
    if (!edge) return;

    const srcNode = nodesRef.current.find(n => n.id === edge.source);
    const tgtNode = nodesRef.current.find(n => n.id === edge.target);
    if (!srcNode || !tgtNode) return;

    const onMove = (ev: PointerEvent) => {
      const c = toCanvas(ev.clientX, ev.clientY);
      const info = edgeDragInfo.current;
      if (!info) return;

      setTempDragNode({ id: 'temp', x: c.x, y: c.y, label: '', width: 1, height: 1 });
      setLiveEdgeOverride(edgesRef.current.map(ed => {
        if (ed.id === info.edgeId) {
          return info.type === 'source'
            ? { ...ed, source: 'temp', sourceHandle: undefined }
            : { ...ed, target: 'temp', targetHandle: undefined };
        }
        return ed;
      }));
    };

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      
      const c = toCanvas(ev.clientX, ev.clientY);
      const info = edgeDragInfo.current;
      if (!info) return;

      const PAD = 15;
      const targetNode = nodesRef.current.find(n => {
        const w = (n.width ?? nodeSizesRef.current[n.id]?.w ?? 180);
        const h = (n.height ?? nodeSizesRef.current[n.id]?.h ?? 70);
        return c.x >= n.x - PAD && c.x <= n.x + w + PAD && 
               c.y >= n.y - PAD && c.y <= n.y + h + PAD;
      });

      if (targetNode) {
        const tw = targetNode.width ?? nodeSizesRef.current[targetNode.id]?.w ?? 155;
        const hVal = targetNode.height ?? nodeSizesRef.current[targetNode.id]?.h ?? 44;
        const dTop = Math.abs(c.y - targetNode.y);
        const dBottom = Math.abs(c.y - (targetNode.y + hVal));
        const dLeft = Math.abs(c.x - targetNode.x);
        const dRight = Math.abs(c.x - (targetNode.x + tw));
        const minD = Math.min(dTop, dBottom, dLeft, dRight);
        
        let newHandle: 'top' | 'right' | 'bottom' | 'left' = 'top';
        if (minD === dRight) newHandle = 'right';
        else if (minD === dBottom) newHandle = 'bottom';
        else if (minD === dLeft) newHandle = 'left';

        push({
          nodes: nodesRef.current,
          edges: edgesRef.current.map(ed => {
            if (ed.id === info.edgeId) {
              return info.type === 'source' 
                ? { ...ed, source: targetNode.id, sourceHandle: newHandle }
                : { ...ed, target: targetNode.id, targetHandle: newHandle };
            }
            return ed;
          })
        });
      }

      edgeDragInfo.current = null;
      setTempDragNode(null);
      setLiveEdgeOverride(null);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [push]);



  const handleLabelChange = useCallback((id: string, label: string) => {
    push({ nodes: nodesRef.current.map(n => n.id === id ? { ...n, label } : n), edges: edgesRef.current });
  }, [push]);

  const handleColorChange = useCallback((id: string, color: string) => {
    push({ nodes: nodesRef.current.map(n => n.id === id ? { ...n, color } : n), edges: edgesRef.current });
  }, [push]);



  const handleShapeChange = useCallback((id: string, shape: NodeData['shape']) => {
    push({ nodes: nodesRef.current.map(n => n.id === id ? { ...n, shape } : n), edges: edgesRef.current });
  }, [push]);

  const handleDeleteNode = useCallback((id: string) => {
    setSelectedNodeIds([]);
    push({
      nodes: nodesRef.current.filter(n => n.id !== id),
      edges: edgesRef.current.filter(e => e.source !== id && e.target !== id),
    });
  }, [push]);

  const handleSizeUpdate = useCallback((id: string, w: number, h: number) => {
    setNodeSizes(prev => {
      if (prev[id]?.w === w && prev[id]?.h === h) return prev;
      return { ...prev, [id]: { w, h } };
    });
  }, []);

  const handleResizeStart = useCallback((id: string, dir: string, clientX: number, clientY: number) => {
    const node = nodesRef.current.find(n => n.id === id);
    if (!node) return;
    const sz = nodeSizesRef.current[id];
    const origW = node.width  ?? sz?.w ?? 160;
    const origH = node.height ?? sz?.h ?? 44;
    resizeInfo.current = {
      id, dir,
      startClientX: clientX, startClientY: clientY,
      origX: node.x, origY: node.y, origW, origH,
    };

    const MIN_W = 100;
    const MIN_H = 40;

    const onMove = (ev: PointerEvent) => {
      const info = resizeInfo.current;
      if (!info) return;
      const sc = canvasRef.current?.getScale() ?? 1;
      const rdx = (ev.clientX - info.startClientX) / sc;
      const rdy = (ev.clientY - info.startClientY) / sc;
      let nx = info.origX, ny = info.origY, nw = info.origW, nh = info.origH;

      if (dir.includes('e')) nw = Math.max(MIN_W, info.origW + rdx);
      if (dir.includes('w')) {
        const d = Math.min(rdx, info.origW - MIN_W);
        nw = info.origW - d;
        nx = info.origX + d;
      }
      if (dir.includes('s')) nh = Math.max(MIN_H, info.origH + rdy);
      if (dir === 'n' || dir === 'ne' || dir === 'nw') {
        const d = Math.min(rdy, info.origH - MIN_H);
        nh = info.origH - d;
        ny = info.origY + d;
      }

      resizeOverrideRef.current = { id, x: nx, y: ny, w: nw, h: nh };
      setResizeOverride({ ...resizeOverrideRef.current });
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const ov = resizeOverrideRef.current;
      if (ov) {
        push({
          nodes: nodesRef.current.map(n =>
            n.id === ov.id ? { ...n, x: ov.x, y: ov.y, width: ov.w, height: ov.h } : n
          ),
          edges: edgesRef.current,
        });
        resizeOverrideRef.current = null;
        setResizeOverride(null);
      }
      resizeInfo.current = null;
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [push]);

  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const handleEdgeMidpointDown = useCallback((e: React.PointerEvent, edgeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedEdgeId(edgeId);
    setSelectedNodeIds([]);
    const toCanvas = (clientX: number, clientY: number) => {
      const pos = canvasRef.current?.getPosition() ?? { x: 0, y: 0 };
      const sc = canvasRef.current?.getScale() ?? 1;
      return { x: (clientX - pos.x) / sc, y: (clientY - pos.y) / sc };
    };

    const edge = edgesRef.current.find(ed => ed.id === edgeId);
    if (!edge) return;
    const srcNode = nodesRef.current.find(n => n.id === edge.source);
    const tgtNode = nodesRef.current.find(n => n.id === edge.target);
    if (!srcNode || !tgtNode) return;

    let hasStartedDragging = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const DRAG_THRESHOLD = 8; // Increased for better stability

    const onMove = (ev: PointerEvent) => {
      if (!hasStartedDragging) {
        const dist = Math.sqrt(Math.pow(ev.clientX - startX, 2) + Math.pow(ev.clientY - startY, 2));
        if (dist > DRAG_THRESHOLD) {
          hasStartedDragging = true;
        } else {
          return;
        }
      }
      const c = toCanvas(ev.clientX, ev.clientY);
      setLiveEdgeOverride(edgesRef.current.map(ed => ed.id === edgeId ? { ...ed, midpoint: { x: c.x, y: c.y } } : ed));
    };

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      
      if (hasStartedDragging) {
        const c = toCanvas(ev.clientX, ev.clientY);
        push({
          nodes: nodesRef.current,
          edges: edgesRef.current.map(ed => ed.id === edgeId ? { ...ed, midpoint: { x: c.x, y: c.y } } : ed)
        });
      }
      setLiveEdgeOverride(null);
      setHoveredEdgeId(null); // Clear hovered state on pointer up
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [push]);
  const handleSelectionBoxChange = useCallback((rect: { x: number; y: number; width: number; height: number; end: boolean } | null) => {
    if (!rect) return;
    const selectedIds: string[] = [];
    nodesRef.current.forEach(n => {
      const w = n.width  ?? nodeSizesRef.current[n.id]?.w ?? 180;
      const h = n.height ?? nodeSizesRef.current[n.id]?.h ?? 70;
      const nX2 = n.x + w;
      const nY2 = n.y + h;
      const rX2 = rect.x + rect.width;
      const rY2 = rect.y + rect.height;
      if (n.x < rX2 && nX2 > rect.x && n.y < rY2 && nY2 > rect.y) {
        selectedIds.push(n.id);
      }
    });

    if (rect.end) {
      setSelectedNodeIds(selectedIds);
    } else {
      setSelectedNodeIds(selectedIds);
    }
  }, []);

  const handleCanvasDoubleClick = useCallback((canvasX: number, canvasY: number) => {
    addNode(canvasX + 70, canvasY + 20);
  }, [addNode]);

  const handleCanvasClick = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    if (modeRef.current === 'connect') {
      updateConnectSource(null);
      setPreviewLine(null);
    }
  }, [updateConnectSource]);

  const handleConnectPortDown = useCallback((e: React.PointerEvent, sourceId: string, handle: 'top'|'right'|'bottom'|'left') => {
    e.preventDefault();
    e.stopPropagation();
    portDragSourceRef.current = sourceId;
    portDragHandleRef.current = handle;
    setSelectedNodeIds([sourceId]);
    setSelectedEdgeId(null);

    const toCanvas = (clientX: number, clientY: number) => {
      const pos = canvasRef.current?.getPosition() ?? { x: 0, y: 0 };
      const sc = canvasRef.current?.getScale() ?? 1;
      return { x: (clientX - pos.x) / sc, y: (clientY - pos.y) / sc };
    };

    const onMove = (ev: PointerEvent) => {
      const src = nodesRef.current.find(n => n.id === portDragSourceRef.current);
      if (!src) return;
      const c = toCanvas(ev.clientX, ev.clientY);
      const sz = nodeSizesRef.current[src.id];
      const w = src.width ?? sz?.w ?? 155;
      const h = src.height ?? sz?.h ?? 44;
      let x1 = src.x + w / 2;
      let y1 = src.y + h / 2;
      switch (portDragHandleRef.current) {
        case 'top': y1 = src.y; break;
        case 'right': x1 = src.x + w; break;
        case 'bottom': y1 = src.y + h; break;
        case 'left': x1 = src.x; break;
      }
      setPreviewLine({ x1, y1, x2: c.x, y2: c.y });
    };

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const src = portDragSourceRef.current;
      const c = toCanvas(ev.clientX, ev.clientY);
      const PAD = 15;
      const target = nodesRef.current.find(n => {
        const w = (n.width ?? nodeSizesRef.current[n.id]?.w ?? 180);
        const h = (n.height ?? nodeSizesRef.current[n.id]?.h ?? 70);
        return n.id !== src &&
               c.x >= n.x - PAD && c.x <= n.x + w + PAD &&
               c.y >= n.y - PAD && c.y <= n.y + h + PAD;
      });
      if (src) {
        if (target) {
          const tw = target.width ?? nodeSizesRef.current[target.id]?.w ?? 155;
          const th = target.height ?? nodeSizesRef.current[target.id]?.h ?? 44;
          const dTop = Math.abs(c.y - target.y);
          const dBottom = Math.abs(c.y - (target.y + th));
          const dLeft = Math.abs(c.x - target.x);
          const dRight = Math.abs(c.x - (target.x + tw));
          const minD = Math.min(dTop, dBottom, dLeft, dRight);
          let targetHandle: 'top'|'right'|'bottom'|'left' = 'top';
          if (minD === dRight) targetHandle = 'right';
          else if (minD === dBottom) targetHandle = 'bottom';
          else if (minD === dLeft) targetHandle = 'left';

          push({ 
            nodes: nodesRef.current, 
            edges: [...edgesRef.current, { 
              id: genId(), 
              source: src, 
              target: target.id, 
              sourceHandle: portDragHandleRef.current || undefined, 
              targetHandle 
            }] 
          });
        } else {
          const newId = genId();
          const newNode: NodeData = { id: newId, x: c.x - 70, y: c.y - 22, label: '' };
          let oppositeHandle: 'top'|'right'|'bottom'|'left' = 'left';
          const srcH = portDragHandleRef.current;
          if (srcH === 'top') oppositeHandle = 'bottom';
          else if (srcH === 'right') oppositeHandle = 'left';
          else if (srcH === 'bottom') oppositeHandle = 'top';
          else if (srcH === 'left') oppositeHandle = 'right';

          const newEdge: Edge = { id: genId(), source: src, target: newId, sourceHandle: srcH || undefined, targetHandle: oppositeHandle };
          push({ nodes: [...nodesRef.current, newNode], edges: [...edgesRef.current, newEdge] });
          setSelectedNodeIds([newId]);
          setNewNodeId(newId);
          setTimeout(() => setNewNodeId(null), 300);
        }
      }
      portDragSourceRef.current = null;
      setPreviewLine(null);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [push]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'Escape') {
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        updateConnectSource(null);
        setPreviewLine(null);
        updateMode('select');
      } else if (e.key === 'n' || e.key === 'N') {
        addNodeCenter();
      } else if (e.key === 's' || e.key === 'S') {
        updateMode('select');
        updateConnectSource(null);
        setPreviewLine(null);
      } else if (e.key === 'c' || e.key === 'C') {
        updateMode('connect');
      } else if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
      } else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
      } else if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        setSelectedNodeIds(nodesRef.current.map(n => n.id));
      } else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        duplicateNode();
      } else if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        canvasRef.current?.resetZoom();
      } else if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        handleFitToScreen();
      } else if (e.key === '?') {
        setShowHelp(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected, addNodeCenter, undo, redo, duplicateNode, updateConnectSource, updateMode]);

  const handleFitToScreen = useCallback(() => {
    const ns = nodesRef.current;
    if (ns.length === 0) return;
    const minX = Math.min(...ns.map(n => n.x));
    const minY = Math.min(...ns.map(n => n.y));
    const maxX = Math.max(...ns.map(n => n.x + (n.width  ?? 160)));
    const maxY = Math.max(...ns.map(n => n.y + (n.height ?? 50)));
    canvasRef.current?.fitToScreen({ minX, minY, maxX, maxY });
  }, []);

  const handleExport = useCallback(async () => {
    const { default: html2canvas } = await import('html2canvas');
    const canvasEl = document.querySelector('.canvas-container') as HTMLElement;
    if (!canvasEl) return;
    const result = await html2canvas(canvasEl, { backgroundColor: '#1A1A1A', scale: 2 });
    const link = document.createElement('a');
    link.download = 'mapa-mental.png';
    link.href = result.toDataURL('image/png');
    link.click();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const s = canvasRef.current?.getScale();
      if (s !== undefined) setScaleDisplay(s);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const handleModeChange = useCallback((newMode: AppMode) => {
    updateMode(newMode);
    updateConnectSource(null);
    setPreviewLine(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
  }, [updateMode, updateConnectSource]);

  const displayNodes = useMemo(() => {
    let r = nodes;
    if (dragDelta) {
      r = r.map(n => selectedNodeIds.includes(n.id) ? { ...n, x: n.x + dragDelta.dx, y: n.y + dragDelta.dy } : n);
    }
    if (resizeOverride?.id) {
      r = r.map(n => n.id === resizeOverride.id
        ? { ...n, x: resizeOverride.x, y: resizeOverride.y, width: resizeOverride.w, height: resizeOverride.h }
        : n);
    }
    if (tempDragNode) {
      r = [...r, tempDragNode];
    }
    return r;
  }, [nodes, dragDelta, selectedNodeIds, resizeOverride, tempDragNode]);

  const displayEdges = useMemo(() => {
    return liveEdgeOverride || edges;
  }, [edges, liveEdgeOverride]);

  return (
    <div 
      className="app-container"
      onContextMenu={(e) => {
        e.preventDefault();
        const pos = canvasRef.current?.getPosition() ?? { x: 0, y: 0 };
        const sc = canvasRef.current?.getScale() ?? 1;
        const canvasX = (e.clientX - pos.x) / sc;
        const canvasY = (e.clientY - pos.y) / sc;
        setContextMenu({ x: e.clientX, y: e.clientY, canvasX, canvasY });
      }}
    >
      <div className="app-logo">
        <img src={logoImg} alt="Growth Mind Logo" className="brand-icon" />
        <div>
          <h1>Growth <span className="logo-accent">Mind</span></h1>
          <p>Futuristic Concept Mapping</p>
        </div>
      </div>

      <Toolbar
        mode={mode}
        scale={scale}
        canUndo={canUndo}
        canRedo={canRedo}
        onModeChange={handleModeChange}
        onAddNode={addNodeCenter}
        onUndo={undo}
        onRedo={redo}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onResetZoom={() => canvasRef.current?.resetZoom()}
        onFitToScreen={handleFitToScreen}
        onExport={handleExport}
        onHelp={() => setShowHelp(true)}
      />

      {mode === 'connect' && (
        <div className="connect-banner">
          {connectSource
            ? 'Clique no nó de destino para conectar'
            : 'Clique no nó de origem'}
          <button onClick={() => handleModeChange('select')}>Cancelar (Esc)</button>
        </div>
      )}

      <InfiniteCanvas
        ref={canvasRef}
        onCanvasDoubleClick={handleCanvasDoubleClick}
        onBackgroundPointerDown={handleCanvasClick}
        onSelectionBoxChange={handleSelectionBoxChange}
      >
        {(currentScale) => {
          const selectedNode = selectedNodeIds.length > 0 ? displayNodes.find(n => n.id === selectedNodeIds[0]) : null;
          const toolbarTop = selectedNode
            ? selectedNode.y + (selectedNode.height ?? nodeSizes[selectedNode.id]?.h ?? 50) + 10
            : 0;

          // Calculate a bounding box for all selected items to show a persistent "area"
          const selectionFrame = (() => {
            if (selectedNodeIds.length < 2) return null; // Show only for multiple nodes
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            displayNodes.forEach(n => {
              if (selectedNodeIds.includes(n.id)) {
                const w = n.width ?? nodeSizes[n.id]?.w ?? 160;
                const h = n.height ?? nodeSizes[n.id]?.h ?? 50;
                minX = Math.min(minX, n.x);
                minY = Math.min(minY, n.y);
                maxX = Math.max(maxX, n.x + w);
                maxY = Math.max(maxY, n.y + h);
              }
            });
            if (minX === Infinity) return null;
            const pad = 12; // Extra padding around nodes
            return {
              x: minX - pad,
              y: minY - pad,
              w: (maxX - minX) + pad * 2,
              h: (maxY - minY) + pad * 2
            };
          })();

          return (
            <>
              {selectionFrame && (
                <div 
                  className="selection-frame"
                  style={{
                    left: selectionFrame.x + 'px',
                    top: selectionFrame.y + 'px',
                    width: selectionFrame.w + 'px',
                    height: selectionFrame.h + 'px'
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    // Clear selection if clicking inside the box but not dragging
                    // handleCanvasClick clears selection and handles connection cancels
                    if (e.button === 0) {
                      // We don't call it immediately because we might want to DRAG
                    }

                    if (selectedNodeIds.length > 0) {
                      setSelectedEdgeId(null);
                      setDragDelta(null);
                      dragDeltaRef.current = null;
                      dragInfo.current = { startX: e.clientX, startY: e.clientY };
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }
                  }}
                  onPointerMove={(e) => handleNodePointerMove(e, currentScale)}
                  onPointerUp={(e) => {
                    const moved = dragInfo.current ? (Math.abs(e.clientX - dragInfo.current.startX) > 3 || Math.abs(e.clientY - dragInfo.current.startY) > 3) : false;
                    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                    handleNodePointerUp();
                    if (!moved) {
                       handleCanvasClick(); // Clear selection if it was just a click
                    }
                  }}
                >
                  {/* ... contents or toolbar ... */}
                </div>
              )}
              <Connections
                nodes={displayNodes}
                edges={displayEdges}
                selectedEdgeId={selectedEdgeId}
                hoveredEdgeId={hoveredEdgeId}
                previewLine={previewLine}
                nodeSizes={nodeSizes}
                onEdgeHandleDown={handleEdgeHandleDown}
                onEdgeMidpointDown={handleEdgeMidpointDown}
                onDeleteEdge={(id) => {
                  push({
                    nodes: nodesRef.current,
                    edges: edgesRef.current.filter(e => e.id !== id)
                  });
                  setSelectedEdgeId(null);
                }}
                setHoveredEdgeId={setHoveredEdgeId}
              />

              {displayNodes.map(node => (
                <MindNode
                  key={node.id}
                  node={node}
                  isSelected={selectedNodeIds.includes(node.id)}
                  isConnectSource={connectSource === node.id}
                  isResizing={resizeOverride?.id === node.id}
                  mode={mode}
                  autoFocus={newNodeId === node.id}
                  isHovered={hoveredNodeId === node.id}
                  onPointerDown={handleNodePointerDown}
                  onPointerMove={(e) => handleNodePointerMove(e, currentScale)}
                  onPointerUp={handleNodePointerUp}
                  onConnectPortDown={handleConnectPortDown}
                  onLabelChange={handleLabelChange}
                  onSizeUpdate={handleSizeUpdate}
                  onResizeStart={handleResizeStart}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                />
              ))}

              {selectedNode && (
                <NodeToolbar
                  node={selectedNode}
                  style={{ position: 'absolute', left: selectedNode.x, top: toolbarTop }}
                  onDelete={() => handleDeleteNode(selectedNode.id)}
                  onColorChange={handleColorChange}
                  onShapeChange={handleShapeChange}
                  onSearch={() => console.log('Search clicked')}
                  onEdit={() => {
                    setNewNodeId(selectedNode.id);
                    setTimeout(() => setNewNodeId(null), 300);
                  }}
                />
              )}
            </>
          );
        }}
      </InfiniteCanvas>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      
      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onNewNode={() => addNode(contextMenu.canvasX, contextMenu.canvasY, '')}
          onSelectAll={() => setSelectedNodeIds(nodesRef.current.map(n => n.id))}
        />
      )}
    </div>
  );
}

export default App;
