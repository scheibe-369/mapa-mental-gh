import React, { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import './InfiniteCanvas.css';

export interface CanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitToScreen: (bounds: { minX: number; minY: number; maxX: number; maxY: number }) => void;
  getScale: () => number;
  getPosition: () => { x: number; y: number };
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
}

interface InfiniteCanvasProps {
  children: (scale: number) => React.ReactNode;
  onCanvasDoubleClick?: (canvasX: number, canvasY: number) => void;
  onBackgroundPointerDown?: (e: React.PointerEvent) => void;
  onSelectionBoxChange?: (rect: { x: number; y: number; width: number; height: number; end: boolean } | null) => void;
}

export const InfiniteCanvas = forwardRef<CanvasHandle, InfiniteCanvasProps>(
  ({ children, onCanvasDoubleClick, onBackgroundPointerDown, onSelectionBoxChange }, ref) => {
    const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
    const [isPanDragging, setIsPanDragging] = useState(false);
    const [isSelectDragging, setIsSelectDragging] = useState(false);
    const [selectStart, setSelectStart] = useState({ x: 0, y: 0 });
    const [selectCur, setSelectCur] = useState({ x: 0, y: 0 });
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const isSelectionPending = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef(view);

    useEffect(() => { viewRef.current = view; }, [view]);

    const screenToCanvas = useCallback((screenX: number, screenY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const v = viewRef.current;
      return {
        x: (screenX - rect.left - v.x) / v.scale,
        y: (screenY - rect.top - v.y) / v.scale,
      };
    }, []);

    const applyZoom = useCallback((factor: number, centerX?: number, centerY?: number) => {
      setView(v => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return v;

        const cx = centerX !== undefined ? centerX : rect.width / 2;
        const cy = centerY !== undefined ? centerY : rect.height / 2;

        const newScale = Math.min(Math.max(0.1, v.scale * factor), 5);
        if (newScale === v.scale) return v;

        // Calculate the exact point on the abstract canvas currently under the cursor
        const canvasX = (cx - v.x) / v.scale;
        const canvasY = (cy - v.y) / v.scale;

        // Position the new canvas view so that the same point remains under the cursor
        return {
          scale: newScale,
          x: cx - canvasX * newScale,
          y: cy - canvasY * newScale,
        };
      });
    }, []);

    useImperativeHandle(ref, () => ({
      zoomIn: () => applyZoom(1.2),
      zoomOut: () => applyZoom(1 / 1.2),
      resetZoom: () => {
        setView({ scale: 1, x: 0, y: 0 });
      },
      fitToScreen: (bounds) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const padding = 80;
        const bW = bounds.maxX - bounds.minX + padding * 2;
        const bH = bounds.maxY - bounds.minY + padding * 2;
        const newScale = Math.min(rect.width / bW, rect.height / bH, 2);
        const newX = (rect.width - bW * newScale) / 2 - (bounds.minX - padding) * newScale;
        const newY = (rect.height - bH * newScale) / 2 - (bounds.minY - padding) * newScale;
        setView({ scale: newScale, x: newX, y: newY });
      },
      getScale: () => viewRef.current.scale,
      getPosition: () => ({ x: viewRef.current.x, y: viewRef.current.y }),
      screenToCanvas,
    }), [applyZoom, screenToCanvas]);

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' && !(e.target as HTMLElement).isContentEditable) {
           setIsSpacePressed(true);
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') setIsSpacePressed(false);
      };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      };
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
        e.preventDefault();
        setIsPanDragging(true);
      } else if (e.button === 0) {
        // Only start selection if clicking directly on the background elements
        const target = e.target as HTMLElement;
        const isBg = target.classList.contains('canvas-background') || 
                     target.classList.contains('canvas-container') ||
                     target.classList.contains('canvas-content');
        
        if (!isBg) return;

        isSelectionPending.current = true;
        if (onBackgroundPointerDown) onBackgroundPointerDown(e);
        // Note: isSelectDragging is now set in handlePointerMove after a threshold
        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        setSelectStart({ x, y });
        setSelectCur({ x, y });
      } else {
        return;
      }
      dragStart.current = { x: e.clientX, y: e.clientY };
      containerRef.current?.setPointerCapture(e.pointerId);
    }, [isSpacePressed, onBackgroundPointerDown, screenToCanvas]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
      if (isPanDragging) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setView(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
        dragStart.current = { x: e.clientX, y: e.clientY };
      } else if (isSelectionPending.current && !isPanDragging && !isSpacePressed) {
        // Initial setup for marquee if threshold is met
        const dx = Math.abs(e.clientX - dragStart.current.x);
        const dy = Math.abs(e.clientY - dragStart.current.y);
        
        if (!isSelectDragging && (dx > 5 || dy > 5)) {
           // We only start selecting if we haven't started and we moved enough
           setIsSelectDragging(true);
        }

        if (isSelectDragging) {
          const { x, y } = screenToCanvas(e.clientX, e.clientY);
          setSelectCur({ x, y });
          if (onSelectionBoxChange) {
             onSelectionBoxChange({
               x: Math.min(selectStart.x, x),
               y: Math.min(selectStart.y, y),
               width: Math.abs(x - selectStart.x),
               height: Math.abs(y - selectStart.y),
               end: false
             });
          }
        }
      }
    }, [isPanDragging, isSelectDragging, isSpacePressed, screenToCanvas, selectStart, onSelectionBoxChange]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
      if (isSelectDragging && onSelectionBoxChange) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        onSelectionBoxChange({
          x: Math.min(selectStart.x, x),
          y: Math.min(selectStart.y, y),
          width: Math.abs(x - selectStart.x),
          height: Math.abs(y - selectStart.y),
          end: true
        });
      }
      isSelectionPending.current = false;
      setIsPanDragging(false);
      setIsSelectDragging(false);
      if (containerRef.current?.hasPointerCapture(e.pointerId)) {
        containerRef.current.releasePointerCapture(e.pointerId);
      }
    }, [isSelectDragging, onSelectionBoxChange, screenToCanvas, selectStart]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      if (target.closest('.mind-node')) return;
      if (!onCanvasDoubleClick) return;
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      onCanvasDoubleClick(x, y);
    }, [onCanvasDoubleClick, screenToCanvas]);

    const handleWheel = useCallback((e: WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 20; // Delta in lines
      if (e.deltaMode === 2) delta *= rect.height; // Delta in pages

      const factor = Math.exp(-delta * 0.001);
      applyZoom(factor, e.clientX - rect.left, e.clientY - rect.top);
    }, [applyZoom]);

    useEffect(() => {
      const container = containerRef.current;
      if (container) {
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
      }
    }, [handleWheel]);

    return (
      <div
        className={`canvas-container ${isSpacePressed ? 'space-pressed' : ''}`}
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{ 
          cursor: isPanDragging ? 'grabbing' : isSpacePressed ? 'grab' : 'default',
          touchAction: 'none',
          userSelect: 'none'
        }}
      >
        <div
          className="canvas-background"
          style={{
            backgroundPosition: `${view.x}px ${view.y}px`,
            backgroundSize: `${20 * view.scale}px ${20 * view.scale}px`,
          }}
        />
        <div
          className="canvas-content"
          style={{
            transformOrigin: '0 0',
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        >
          {children(view.scale)}
          {isSelectDragging && (
            <div
              className={`selection-box active`}
              style={{
                left: Math.min(selectStart.x, selectCur.x) + 'px',
                top: Math.min(selectStart.y, selectCur.y) + 'px',
                width: Math.abs(selectCur.x - selectStart.x) + 'px',
                height: Math.abs(selectCur.y - selectStart.y) + 'px',
              }}
            />
          )}
        </div>
      </div>
    );
  }
);

InfiniteCanvas.displayName = 'InfiniteCanvas';
