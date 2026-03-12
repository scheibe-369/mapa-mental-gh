import React from 'react';
import type { AppMode } from '../types';
import './Toolbar.css';

interface ToolbarProps {
  mode: AppMode;
  scale: number;
  canUndo: boolean;
  canRedo: boolean;
  onModeChange: (mode: AppMode) => void;
  onAddNode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToScreen: () => void;
  onExport: () => void;
  onHelp: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  scale,
  canUndo,
  canRedo,
  onModeChange,
  onAddNode,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  onExport,
  onHelp,
}) => {
  return (
    <div className="toolbar">
      {/* Mode buttons */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn${mode === 'select' ? ' active' : ''}`}
          onClick={() => onModeChange('select')}
          title="Selecionar / Mover (S)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 2L13 8L8 9.5L6.5 14L3 2Z" fill="currentColor"/>
          </svg>
          <span>Selecionar</span>
        </button>
        <button
          className={`toolbar-btn${mode === 'connect' ? ' active' : ''}`}
          onClick={() => onModeChange('connect')}
          title="Conectar nós (C)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="3" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="13" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 8H11" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 6L11 8L9 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Conectar</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Node actions */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onAddNode} title="Novo nó (N)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="4" width="14" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 7V9M7 8H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Novo</span>
        </button>
        <button className="toolbar-btn" onClick={onUndo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 6H9C11.2 6 13 7.8 13 10C13 12.2 11.2 14 9 14H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M3 6L6 3M3 6L6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="toolbar-btn" onClick={onRedo} disabled={!canRedo} title="Refazer (Ctrl+Y)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13 6H7C4.8 6 3 7.8 3 10C3 12.2 4.8 14 7 14H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M13 6L10 3M13 6L10 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Zoom controls */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onZoomOut} title="Zoom out (−)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 7H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="toolbar-zoom-label" onClick={onResetZoom} title="Resetar zoom (Ctrl+0)">
          {Math.round(scale * 100)}%
        </button>
        <button className="toolbar-btn" onClick={onZoomIn} title="Zoom in (+)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 7H9M7 5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="toolbar-btn" onClick={onFitToScreen} title="Fit to screen (Ctrl+Shift+F)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 5V2H5M11 2H14V5M14 11V14H11M5 14H2V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Export & Help */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={onExport} title="Exportar PNG">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2V10M5 7L8 10L11 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12H14V14H2V12Z" fill="currentColor" opacity="0.5"/>
          </svg>
          <span>Export</span>
        </button>
        <button className="toolbar-btn" onClick={onHelp} title="Ajuda (?)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M6 6C6 5 6.8 4.5 8 4.5C9.2 4.5 10 5.2 10 6C10 7 9 7.5 8 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="11" r="0.75" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
