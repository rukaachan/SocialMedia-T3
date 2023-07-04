import { useSession } from "next-auth/react";
import Button from "./Button";
import ProfileImage from "./ProfileImage";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

function updateTextAreaSize(textArea?: HTMLTextAreaElement) {
  if (textArea == null) return;

  /**
   * If there is a textarea element:
   * Set the initial height and make it dynamic
   * The textarea will expand downwards using the scrollHeight property
   */

  textArea.style.height = "0";
  textArea.style.height = `${textArea.scrollHeight}px`;
}

export default function NewTweetForm() {
  const session = useSession();

  if (session.status !== "authenticated") return;

  return <Form />;
}

function Form() {
  const session = useSession();
  const [inputValue, setInputValue] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement>();

  // in here make it some callback function for updateTextAreaSize
  const inputRef = useCallback((textArea: HTMLTextAreaElement) => {
    updateTextAreaSize(textArea);
    textAreaRef.current = textArea;
  }, []);

  // will render if there triggerd in inputValue
  useLayoutEffect(() => {
    updateTextAreaSize(textAreaRef.current);
  }, [inputValue]);

  if (session.status !== "authenticated") return;

  return (
    <form className="flex flex-col gap-2 border-b px-4">
      <div className="flex gap-4">
        <ProfileImage src={session.data?.user?.image} />
        <textarea
          ref={inputRef}
          style={{ height: 0 }}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-grow resize-none overflow-hidden p-4 text-lg outline-none"
          placeholder="What's happening?"
        ></textarea>
      </div>
      <Button className="my-2 self-end">Tweet</Button>
    </form>
  );
}
