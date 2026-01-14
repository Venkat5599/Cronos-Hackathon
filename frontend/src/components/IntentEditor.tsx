import { useState } from 'react';
import { PaymentIntent } from '../types';

interface IntentEditorProps {
  intent: PaymentIntent;
  onChange: (intent: PaymentIntent) => void;
  onSimulate: () => void;
  onReset: () => void;
  isLoading: boolean;
  buttonText?: string;
  buttonDisabled?: boolean;
}

function IntentEditor({ intent, onChange, onSimulate, onReset, isLoading, buttonText, buttonDisabled }: IntentEditorProps) {
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'json' | 'form'>('json');

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      const parsed = JSON.parse(e.target.value);
      onChange(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError('Invalid JSON');
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    const newIntent = { ...intent };
    if (field.startsWith('intent.')) {
      const key = field.replace('intent.', '') as keyof typeof intent.intent;
      newIntent.intent = { ...newIntent.intent, [key]: value };
    } else if (field.startsWith('metadata.')) {
      const key = field.replace('metadata.', '') as keyof typeof intent.metadata;
      newIntent.metadata = { ...newIntent.metadata, [key]: value };
    }
    onChange(newIntent);
  };

  const jsonString = JSON.stringify(intent, null, 2);

  return (
    <>
      <div className="flex items-center justify-between px-2">
        <h3 className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-sm">terminal</span>
          Payment Intent
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode('form')}
            className={`text-[10px] font-mono px-2 py-1 rounded ${editMode === 'form' ? 'bg-primary/20 text-primary' : 'text-[#8dc0ce] hover:text-white'}`}
          >
            FORM
          </button>
          <button
            onClick={() => setEditMode('json')}
            className={`text-[10px] font-mono px-2 py-1 rounded ${editMode === 'json' ? 'bg-primary/20 text-primary' : 'text-[#8dc0ce] hover:text-white'}`}
          >
            JSON
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-[#0a1518] border border-border-dark p-6 shadow-2xl relative">
        <div className="absolute top-4 right-4 flex gap-2">
          <div className="size-2 rounded-full bg-red-500/50" />
          <div className="size-2 rounded-full bg-yellow-500/50" />
          <div className={`size-2 rounded-full ${jsonError ? 'bg-red-500' : 'bg-green-500/50'}`} />
        </div>
        
        {editMode === 'json' ? (
          <textarea
            className="w-full h-[280px] bg-transparent mono-text text-primary/90 text-sm leading-relaxed resize-none focus:outline-none overflow-hidden"
            value={jsonString}
            onChange={handleJsonChange}
            spellCheck={false}
            style={{ scrollbarWidth: 'none' }}
          />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-[#8dc0ce] uppercase font-bold block mb-1">Recipient</label>
              <input
                type="text"
                value={intent.intent.recipient}
                onChange={(e) => handleFieldChange('intent.recipient', e.target.value)}
                className="w-full bg-background-dark/50 border border-border-dark rounded px-3 py-2 text-sm mono-text text-white focus:outline-none focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-[#8dc0ce] uppercase font-bold block mb-1">Amount</label>
                <input
                  type="text"
                  value={intent.intent.amount}
                  onChange={(e) => handleFieldChange('intent.amount', e.target.value)}
                  className="w-full bg-background-dark/50 border border-border-dark rounded px-3 py-2 text-sm mono-text text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8dc0ce] uppercase font-bold block mb-1">Asset</label>
                <select
                  value={intent.intent.asset}
                  onChange={(e) => handleFieldChange('intent.asset', e.target.value)}
                  className="w-full bg-background-dark/50 border border-border-dark rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="CRO">CRO</option>
                  <option value="USDC">USDC</option>
                  <option value="USDT">USDT</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-[#8dc0ce] uppercase font-bold block mb-1">Chain ID</label>
                <select
                  value={intent.intent.chain_id}
                  onChange={(e) => handleFieldChange('intent.chain_id', e.target.value)}
                  className="w-full bg-background-dark/50 border border-border-dark rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="338">338 (Testnet)</option>
                  <option value="25">25 (Mainnet)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#8dc0ce] uppercase font-bold block mb-1">Priority</label>
                <select
                  value={intent.metadata.priority || 'medium'}
                  onChange={(e) => handleFieldChange('metadata.priority', e.target.value)}
                  className="w-full bg-background-dark/50 border border-border-dark rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#8dc0ce] uppercase font-bold block mb-1">Memo</label>
              <input
                type="text"
                value={intent.intent.memo || ''}
                onChange={(e) => handleFieldChange('intent.memo', e.target.value)}
                className="w-full bg-background-dark/50 border border-border-dark rounded px-3 py-2 text-sm mono-text text-white focus:outline-none focus:border-primary"
                placeholder="Optional memo"
              />
            </div>
          </div>
        )}
        
        {jsonError && (
          <p className="text-danger-red text-xs mt-2">{jsonError}</p>
        )}
      </div>

      <div className="flex items-center gap-4 pt-4">
        <button
          onClick={onSimulate}
          disabled={isLoading || !!jsonError || buttonDisabled}
          className="flex-1 bg-primary hover:bg-[#00b0e0] disabled:bg-primary/50 text-background-dark font-bold py-4 px-8 rounded-lg flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-primary/20 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Querying Chain...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">link</span>
              {buttonText || 'Check On-Chain'}
            </>
          )}
        </button>
        
        <button
          onClick={onReset}
          className="px-6 py-4 rounded-lg border border-border-dark text-[#8dc0ce] hover:bg-white/5 transition-colors"
          title="Reset to default"
        >
          <span className="material-symbols-outlined">settings_backup_restore</span>
        </button>
      </div>
    </>
  );
}

export default IntentEditor;
