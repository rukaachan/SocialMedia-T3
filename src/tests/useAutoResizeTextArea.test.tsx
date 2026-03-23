import { render, screen } from "@testing-library/react";
import { useAutoResizeTextArea } from "~/hooks/useAutoResizeTextArea";

function HookHarness({ value }: { value: string }) {
  const textAreaRef = useAutoResizeTextArea(value);

  return (
    <textarea
      ref={textAreaRef}
      aria-label="tweet-input"
      value={value}
      readOnly
    />
  );
}

describe("src/hooks/useAutoResizeTextArea.ts", () => {
  it("resizes the textarea from its scrollHeight when the value changes", () => {
    let scrollHeightValue = 72;

    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get: () => scrollHeightValue,
    });

    const { rerender } = render(<HookHarness value="Hello" />);

    const textArea = screen.getByLabelText("tweet-input");
    expect(textArea).toHaveStyle({ height: "72px" });

    scrollHeightValue = 96;
    rerender(<HookHarness value="Hello again" />);

    expect(textArea).toHaveStyle({ height: "96px" });
  });
});
