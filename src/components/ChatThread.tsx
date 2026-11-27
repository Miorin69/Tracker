import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../utils/chatLogic';

interface ChatThreadProps {
  messages: ChatMessage[];
  isSending: boolean;
  isRetrying: boolean;
  errorMessage: string | null;
  assistantName: string;
  placeholder: string;
  emptyHeading: string;
  emptyDescription: string;
  starterPrompts: readonly string[];
  inputId: string;
  inputLabel: string;
  threadHeightClass?: string;
  surfaceClass?: string;
  onSend: (text: string) => void;
  onRetry?: () => void;
  onClear: () => void;
  renderAssistantAction?: (message: ChatMessage) => React.ReactNode;
}

export function ChatThread({
  messages,
  isSending,
  isRetrying,
  errorMessage,
  assistantName,
  placeholder,
  emptyHeading,
  emptyDescription,
  starterPrompts,
  inputId,
  inputLabel,
  threadHeightClass = 'h-[320px]',
  surfaceClass = 'bg-[#100a20]',
  onSend,
  onRetry,
  onClear,
  renderAssistantAction,
}: ChatThreadProps) {
  const [draft, setDraft] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) {
      setValidationError('Enter a message before sending.');
      return;
    }
    setValidationError(null);
    setDraft('');
    onSend(trimmed);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Top toolbar when conversation has messages */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between gap-2 pb-2">
          <span className="text-[11px] font-medium text-[#9f8ec7]">
            {messages.length}{' '}
            {messages.length === 1 ? 'message' : 'messages'} in thread
          </span>
          <button
            type="button"
            onClick={onClear}
            disabled={isSending}
            className="text-[11px] font-medium text-[#c5b8e3] hover:text-[#ffd166] underline underline-offset-2 disabled:opacity-50 cursor-pointer"
          >
            Clear chat
          </button>
        </div>
      )}

      {/* Scrollable conversation thread */}
      <div
        ref={scrollContainerRef}
        role="log"
        aria-live="polite"
        aria-label={`${assistantName} conversation`}
        className={`${threadHeightClass} overflow-y-auto border border-[#35285b] rounded-md p-3 space-y-3 ${surfaceClass}`}
      >
        {messages.length === 0 ? (
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#faf7ff]">
                {emptyHeading}
              </p>
              <p className="text-xs text-[#b7a8d9] leading-relaxed">
                {emptyDescription}
              </p>
            </div>
            <div className="space-y-1.5">
              <span className="block text-[11px] font-medium text-[#9f8ec7]">
                Try asking
              </span>
              <div className="flex flex-col gap-1.5">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={isSending}
                    onClick={() => {
                      setValidationError(null);
                      onSend(prompt);
                    }}
                    className="w-full text-left px-2.5 py-2 text-xs text-[#e6ddf8] bg-[#1a1333] border border-[#35285b] rounded-md hover:bg-[#251a46] hover:border-[#ff4fa3]/60 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[92%] rounded-md px-3 py-2 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-[#2f1d4e] text-[#faf7ff] border border-[#ff4fa3]/50'
                      : 'bg-[#191233] text-[#e6ddf8] border border-[#35285b]'
                  }`}
                >
                  <div
                    className={`text-[10px] font-semibold mb-1 ${
                      isUser ? 'text-[#ff85bc]' : 'text-[#22d3ee]'
                    }`}
                  >
                    {isUser ? 'You' : assistantName}
                  </div>
                  <div className="whitespace-pre-wrap break-words">
                    {msg.text}
                  </div>
                </div>
                {!isUser && renderAssistantAction && (
                  <div className="mt-1.5">{renderAssistantAction(msg)}</div>
                )}
              </div>
            );
          })
        )}

        {isSending && (
          <div
            role="status"
            aria-label={`${assistantName} is replying`}
            className="flex items-start"
          >
            <div className="px-3 py-2 text-xs text-[#c5b8e3] bg-[#191233] border border-[#35285b] rounded-md">
              {isRetrying
                ? 'Service busy — retrying automatically...'
                : `${assistantName} is thinking...`}
            </div>
          </div>
        )}
      </div>

      {/* Error banner */}
      {errorMessage && !isSending && (
        <div
          role="alert"
          className="mt-2 px-3 py-2 text-xs text-[#fecdd3] bg-[#3b1224] border border-[#fb7185]/50 rounded-md flex items-center justify-between gap-2"
        >
          <span>{errorMessage}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="font-semibold text-white underline underline-offset-2 shrink-0 cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSubmit} className="mt-2.5 space-y-1.5 shrink-0">
        <label htmlFor={inputId} className="sr-only">
          {inputLabel}
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder={placeholder}
            disabled={isSending}
            className="flex-1 min-w-0 h-9 px-3 text-xs text-[#faf7ff] bg-[#110c23] border border-[#3e2f6b] rounded-md placeholder:text-[#78689e] focus:outline-none focus:border-[#22d3ee] focus:ring-1 focus:ring-[#22d3ee] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isSending}
            className="px-3.5 h-9 text-xs font-bold vice-sunset-btn rounded-md disabled:opacity-60 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
        {validationError && (
          <p role="alert" className="text-xs text-[#fda4af]">
            {validationError}
          </p>
        )}
      </form>
    </div>
  );
}
