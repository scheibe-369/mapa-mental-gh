import React, { useEffect, useRef } from 'react';
import './ContextMenu.css';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onNewNode: () => void;
  onSelectAll: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onNewNode, onSelectAll }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Determine screen position so it doesn't overflow
    const el = menuRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const rightOverflow = rect.right - window.innerWidth;
      const bottomOverflow = rect.bottom - window.innerHeight;

      if (rightOverflow > 0) {
        el.style.left = `${x - rightOverflow - 10}px`;
      }
      if (bottomOverflow > 0) {
        el.style.top = `${y - bottomOverflow - 10}px`;
      }
    }

    const handleClickOutside = () => {
      onClose();
    };

    document.addEventListener('pointerdown', handleClickOutside);
    // Also capture right clicks outside to close
    document.addEventListener('contextmenu', handleClickOutside);
    
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [x, y, onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
      onPointerDown={(e) => {
        // Prevent closing right away when clicking inside the menu
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="context-menu-header">Opções do Mapa</div>
      <button 
        className="context-menu-item" 
        onClick={() => { onNewNode(); onClose(); }}
      >
        <span>Criar Novo Card</span>
        <span className="shortcut">Duplo clique</span>
      </button>
      <button 
        className="context-menu-item"
        onClick={() => { onSelectAll(); onClose(); }}
      >
        <span>Selecionar Todos</span>
        <span className="shortcut">Ctrl+A</span>
      </button>
      <div className="context-menu-divider" />
      <button 
        className="context-menu-item"
        onClick={() => { 
          // Native clibpoard paste triggers onpaste on document
          navigator.clipboard.read().catch(() => {});
          onClose(); 
        }}
        title="Para colar imagens use Ctrl+V / Cmd+V"
      >
        <span>Colar Imagem</span>
        <span className="shortcut">Ctrl+V</span>
      </button>
    </div>
  );
};
