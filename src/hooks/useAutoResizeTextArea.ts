import { useCallback, useLayoutEffect, useRef } from "react";

function updateTextAreaSize(textArea?: HTMLTextAreaElement | null) {
  if (textArea == null) return;

  textArea.style.height = "0";
  textArea.style.height = `${textArea.scrollHeight}px`;
}

export function useAutoResizeTextArea(value: string) {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const inputRef = useCallback((textArea: HTMLTextAreaElement | null) => {
    updateTextAreaSize(textArea);
    textAreaRef.current = textArea;
  }, []);

  useLayoutEffect(() => {
    void value;

    updateTextAreaSize(textAreaRef.current);
  }, [value]);

  return inputRef;
}
