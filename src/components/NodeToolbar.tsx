import React, { useState } from 'react';
import type { NodeData } from '../types';
import './NodeToolbar.css';

const NODE_COLORS = [
  { label: 'Roxo', value: '#7C3AED' },
  { label: 'Azul', value: '#3B82F6' },
  { label: 'Verde', value: '#10B981' },
  { label: 'Vermelho', value: '#EF4444' },
  { label: 'Amarelo', value: '#F59E0B' },
  { label: 'Rosa', value: '#EC4899' },
  { label: 'Cinza', value: '#374151' },
  { label: 'Padrão', value: '' },
];

interface NodeToolbarProps {
  node: NodeData;
  style?: React.CSSProperties;
  onDelete?: () => void;
  onColorChange: (id: string, color: string) => void;
  onShapeChange: (id: string, shape: NodeData['shape']) => void;
  onSearch?: () => void;
  onEdit?: () => void;
}

export const NodeToolbar: React.FC<NodeToolbarProps> = ({
  node,
  style,
  onDelete,
  onColorChange,
  onShapeChange,
  onSearch,
  onEdit,
}) => {
  const [activeMenu, setActiveMenu] = useState<'none' | 'color' | 'shape'>('none');

  const toggleMenu = (menu: 'color' | 'shape') => {
    setActiveMenu(prev => prev === menu ? 'none' : menu);
  };

  return (
    <div
      className="node-action-menu-wrapper"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {activeMenu === 'color' && (
        <div className="action-submenu">
          <div className="node-color-picker">
            {NODE_COLORS.map((c) => (
              <button
                key={c.value}
                className={`color-dot${node.color === c.value ? ' active' : ''}`}
                style={{ background: c.value || '#242424', border: c.value ? `2px solid ${c.value}` : '2px solid #444' }}
                title={c.label}
                onClick={() => {
                  onColorChange(node.id, c.value);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {activeMenu === 'shape' && (
        <div className="action-submenu">
          <div className="node-shape-controls">
            <button
              className={!node.shape || node.shape === 'rect' ? 'active' : ''}
              onClick={() => { onShapeChange(node.id, 'rect'); }}
              title="Retângulo"
            >▭</button>
            <button
              className={node.shape === 'ellipse' ? 'active' : ''}
              onClick={() => { onShapeChange(node.id, 'ellipse'); }}
              title="Elipse"
            >◯</button>
            <button
              className={node.shape === 'diamond' ? 'active' : ''}
              onClick={() => { onShapeChange(node.id, 'diamond'); }}
              title="Diamante"
            >◆</button>
          </div>
        </div>
      )}

      <div className="node-action-menu">
        <button className="action-menu-btn" onClick={onDelete} title="Deletar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>

        <button className={`action-menu-btn ${activeMenu === 'color' ? 'active' : ''}`} onClick={() => toggleMenu('color')} title="Cores">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.5-1.638-.173-1.037.747-1.862 1.5-1.862H17c3.314 0 6-2.686 6-6 0-6-5.373-10.5-11-10.5z"/>
          </svg>
        </button>

        <button className={`action-menu-btn ${activeMenu === 'shape' ? 'active' : ''}`} onClick={() => toggleMenu('shape')} title="Formas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l10 18H2L12 3z"/>
            <path d="M19 19a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" opacity="0.6"/>
            <rect x="2" y="5" width="8" height="8" rx="1" opacity="0.6"/>
          </svg>
        </button>

        <button className="action-menu-btn" onClick={onSearch} title="Buscar / Analisar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8V6a2 2 0 0 1 2-2h2"/>
            <path d="M4 16v2a2 2 0 0 0 2 2h2"/>
            <path d="M16 4h2a2 2 0 0 1 2 2v2"/>
            <path d="M16 20h2a2 2 0 0 0 2-2v-2"/>
            <circle cx="11" cy="11" r="3"/>
            <line x1="13.5" y1="13.5" x2="16" y2="16"/>
          </svg>
        </button>

        <button className="action-menu-btn" onClick={onEdit} title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
