/**
 * CodeEditor - Simple code editor for student solutions
 *
 * A basic textarea-based editor. Can be upgraded to Monaco later.
 */

import { useState, useCallback } from 'react';

interface CodeEditorProps {
  initialCode: string;
  onChange?: (code: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function CodeEditor({
  initialCode,
  onChange,
  disabled = false,
  placeholder = '// Write your code here...',
}: CodeEditorProps) {
  const [code, setCode] = useState(initialCode);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newCode = e.target.value;
      setCode(newCode);
      onChange?.(newCode);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle Tab key for indentation
      if (e.key === 'Tab') {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newCode = code.slice(0, start) + '  ' + code.slice(end);
        setCode(newCode);
        onChange?.(newCode);

        // Restore cursor position
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        }, 0);
      }
    },
    [code, onChange]
  );

  return (
    <textarea
      value={code}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder={placeholder}
      spellCheck={false}
      style={{
        width: '100%',
        minHeight: '200px',
        padding: '12px',
        fontFamily: 'monospace',
        fontSize: '14px',
        lineHeight: '1.5',
        backgroundColor: disabled ? '#f5f5f5' : '#1e1e1e',
        color: disabled ? '#666' : '#d4d4d4',
        border: '1px solid #333',
        borderRadius: '4px',
        resize: 'vertical',
        outline: 'none',
      }}
    />
  );
}
