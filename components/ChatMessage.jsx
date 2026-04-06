'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Bot, Database, User } from 'lucide-react';

const ChatMessage = ({ message, isUser, timestamp, isError, hasRealTimeData }) => {
  // Format bot responses to be more professional
  const formatBotMessage = (text) => {
    if (isUser) return text;
    
    // Remove asterisks and format the content professionally
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-red-700 dark:text-red-300">$1</strong>') // Bold text
      .replace(/\*(.*?)\*/g, '<em class="font-medium text-gray-700 dark:text-gray-300">$1</em>') // Italic text
      .replace(/^[\*\-\+]\s+/gm, '• ') // Convert asterisk/dash/plus bullets to proper bullets
      .replace(/^\d+\.\s+/gm, (match) => `<span class="font-medium text-red-600 dark:text-red-400">${match}</span>`) // Number lists
      .replace(/\n\n/g, '<br><br>') // Double line breaks
      .replace(/\n/g, '<br>'); // Single line breaks
    
    // Add proper spacing and structure for blood type information
    if (formatted.includes('Type A') || formatted.includes('Type B') || formatted.includes('Type AB') || formatted.includes('Type O')) {
      formatted = formatted
        .replace(/(Type [ABO]+[\+\-]*:)/g, '<div class="mt-3 mb-2"><span class="inline-block bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 py-1 rounded-md text-sm font-semibold">$1</span></div>')
        .replace(/Rh factor/g, '<span class="font-semibold text-blue-600 dark:text-blue-400">Rh factor</span>');
    }
    
    return formatted;
  };

  const [sanitizedHtml, setSanitizedHtml] = useState('');
  const [domPurifyLoaded, setDomPurifyLoaded] = useState(false);
  const [formattedText, setFormattedText] = useState('');

  const escapeAndPreserveNewlines = (txt) => txt ? txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>') : '';

  // Helper to render fallback (no DOMPurify) as React nodes with clickable internal links and inline formatting
  const renderFallbackAsReact = (txt) => {
    if (!txt) return null;
    // Detect internal paths like /emergency or /register/donor
    const linkRegex = /(\/[A-Za-z0-9\-\/]+(?:\?[A-Za-z0-9=%_\-&]*)?)/g;
    // Match <strong>...</strong> or <em>...</em>
    const inlineTagRegex = /<(strong|em)[^>]*>(.*?)<\/\1>/gi;

    const processTextForLinks = (text, parentKey) => {
      const parts = [];
      let lastIndex = 0;
      const r = new RegExp(linkRegex); // fresh regex so exec state is clean
      let m;
      while ((m = r.exec(text)) !== null) {
        if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
        parts.push(
          <a key={`${parentKey}-a-${m.index}`} href={m[0]} className="text-red-600 underline" rel="noopener noreferrer">
            {m[0]}
          </a>
        );
        lastIndex = m.index + m[0].length;
      }
      if (lastIndex < text.length) parts.push(text.slice(lastIndex));
      return parts;
    };

    const lines = txt.split('\n');
    return lines.map((line, idx) => {
      const nodes = [];
      let lastIndex = 0;
      let match;

      inlineTagRegex.lastIndex = 0; // reset
      while ((match = inlineTagRegex.exec(line)) !== null) {
        const [fullMatch, tag, inner] = match;
        // push preceding text
        if (match.index > lastIndex) nodes.push({ type: 'text', content: line.slice(lastIndex, match.index) });
        // push formatted node
        nodes.push({ type: tag, content: inner });
        lastIndex = match.index + fullMatch.length;
      }

      if (lastIndex < line.length) nodes.push({ type: 'text', content: line.slice(lastIndex) });

      // Convert nodes into React elements, auto-linking text parts
      const children = nodes.flatMap((n, i) => {
        if (n.type === 'text') {
          return processTextForLinks(n.content, `${idx}-${i}`);
        }
        if (n.type === 'strong') {
          // process inner for links too
          const innerParts = processTextForLinks(n.content, `${idx}-${i}-strong`);
          return (
            <strong key={`${idx}-${i}-strong`} className="font-semibold text-red-700 dark:text-red-300">
              {innerParts}
            </strong>
          );
        }
        if (n.type === 'em') {
          const innerParts = processTextForLinks(n.content, `${idx}-${i}-em`);
          return (
            <em key={`${idx}-${i}-em`} className="font-medium text-gray-700 dark:text-gray-300">
              {innerParts}
            </em>
          );
        }
        return null;
      });

      return (
        <span key={idx}>
          {children}
          {idx < lines.length - 1 && <br />}
        </span>
      );
    });
  };

  useEffect(() => {
    if (isUser) return;
    const formatted = formatBotMessage(message || '');
    // Keep a plain-text version where HTML <br> becomes newline characters for the React fallback renderer
    setFormattedText(formatted.replace(/<br\s*\/?/gi, '\n'));
    let cancelled = false;
    (async () => {
      try {
        const DOMPurify = (await import('dompurify')).default;
        const sanitized = DOMPurify.sanitize(formatted);
        if (!cancelled) {
          setSanitizedHtml(sanitized);
          setDomPurifyLoaded(true);
        }
      } catch (e) {
        setDomPurifyLoaded(false);
        // Fallback: strip tags and escape text (safe without DOMPurify)
        let escaped = '';
        if (typeof document !== 'undefined') {
          const tmp = document.createElement('div');
          tmp.innerHTML = formatted;
          const text = tmp.textContent || tmp.innerText || '';
          escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
        } else {
          // As last resort, remove tags via regex and escape
          const text = formatted.replace(/<[^>]*>/g, '');
          escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
        }
        if (!cancelled) setSanitizedHtml(escaped);
      }
    })();
    return () => { cancelled = true; };
  }, [message, isUser]);

  return (
    <div className={`flex gap-3 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isError 
            ? 'bg-red-100 dark:bg-red-900' 
            : 'bg-gradient-to-br from-red-500 to-red-600 shadow-md'
        }`}>
          {isError ? (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          ) : (
            <Bot className="w-4 h-4 text-white" />
          )}
        </div>
      )}
      
      <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`rounded-xl px-4 py-3 relative shadow-sm ${
            isUser
              ? 'bg-gradient-to-r from-red-600 to-red-700 text-white ml-auto shadow-md'
              : isError
              ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-sm'
          }`}
        >
          {hasRealTimeData && !isUser && (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mb-3 pb-2 border-b border-green-200 dark:border-green-800">
              <Database className="w-3 h-3" />
              <span className="font-medium">Real-time data included</span>
            </div>
          )}
          
          {!isUser ? (
            domPurifyLoaded && sanitizedHtml ? (
              <div 
                className="text-sm leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            ) : (
              // If DOMPurify is not available, render a safe React fallback that preserves newlines and converts internal paths to links
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {renderFallbackAsReact(formattedText || message)}
              </div>
            )
          ) : (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {message}
            </div>
          )}
          
          {/* Message tail */}
          <div className={`absolute top-4 ${
            isUser 
              ? 'right-0 transform translate-x-full' 
              : 'left-0 transform -translate-x-full'
          }`}>
            <div className={`w-0 h-0 ${
              isUser
                ? 'border-l-8 border-red-600 border-t-4 border-b-4 border-t-transparent border-b-transparent'
                : isError
                ? 'border-r-8 border-white dark:border-gray-800 border-t-4 border-b-4 border-t-transparent border-b-transparent'
                : 'border-r-8 border-white dark:border-gray-800 border-t-4 border-b-4 border-t-transparent border-b-transparent'
            }`}></div>
          </div>
        </div>
        
        {timestamp && (
          <div className={`text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1 ${
            isUser ? 'text-right justify-end' : 'text-left justify-start'
          }`}>
            <span>
              {new Date(timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            {hasRealTimeData && !isUser && (
              <span className="text-green-500 font-medium">• Live data</span>
            )}
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-md">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
