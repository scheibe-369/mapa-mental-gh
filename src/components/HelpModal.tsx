import React, { useEffect } from 'react';
import './HelpModal.css';

interface HelpModalProps {
  onClose: () => void;
}

const shortcuts = [
  { keys: ['Double-click no canvas'], desc: 'Criar novo nó na posição' },
  { keys: ['N'], desc: 'Criar novo nó no centro' },
  { keys: ['Delete', 'Backspace'], desc: 'Deletar nó(s) selecionado(s)' },
  { keys: ['Escape'], desc: 'Desselecionar / cancelar' },
  { keys: ['Ctrl', 'Z'], desc: 'Desfazer' },
  { keys: ['Ctrl', 'Y'], desc: 'Refazer' },
  { keys: ['Ctrl', 'A'], desc: 'Selecionar todos os nós' },
  { keys: ['Ctrl', 'D'], desc: 'Duplicar nó selecionado' },
  { keys: ['S'], desc: 'Modo Selecionar' },
  { keys: ['C'], desc: 'Modo Conectar' },
  { keys: ['Scroll'], desc: 'Zoom in/out' },
  { keys: ['Ctrl', '0'], desc: 'Resetar zoom' },
  { keys: ['Ctrl', 'Shift', 'F'], desc: 'Fit to screen' },
];

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-header">
          <h2>Atalhos de Teclado</h2>
          <button className="help-close" onClick={onClose}>×</button>
        </div>
        <div className="help-body">
          <table className="help-table">
            <tbody>
              {shortcuts.map((s, i) => (
                <tr key={i}>
                  <td>
                    {s.keys.map((k, ki) => (
                      <React.Fragment key={ki}>
                        {ki > 0 && <span className="key-sep">+</span>}
                        <kbd className="key">{k}</kbd>
                      </React.Fragment>
                    ))}
                  </td>
                  <td className="help-desc">{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="help-tips">
            <p>💡 <strong>Modo Conectar:</strong> Clique no nó de origem, depois no nó de destino.</p>
            <p>💡 <strong>Pan:</strong> Arraste o fundo do canvas.</p>
            <p>💡 <strong>Zoom:</strong> Scroll do mouse centralizado no cursor.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
