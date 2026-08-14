import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PostMediaPicker, { type SelectedPostImage } from "~/components/PostMediaPicker";

describe("PostMediaPicker", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test-image"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("supports keyboard-labelled selection, required alt text, and removal", () => {
    function Harness() {
      const [value, setValue] = useState<SelectedPostImage[]>([]);
      return <PostMediaPicker value={value} onChange={setValue} />;
    }

    render(<Harness />);

    const file = new File([new Uint8Array([1, 2, 3])], "photo.png", {
      type: "image/png",
    });
    fireEvent.change(screen.getByLabelText("Add images"), {
      target: { files: [file] },
    });

    expect(screen.getByLabelText("Alt text")).toBeRequired();
    expect(screen.getByRole("button", { name: "Remove image 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove image 1" }));
    expect(screen.queryByLabelText("Alt text")).not.toBeInTheDocument();
  });
});
