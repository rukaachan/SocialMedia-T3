import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PostMediaGallery from "~/components/PostMediaGallery";

describe("PostMediaGallery", () => {
  it("keeps media keyboard reachable with descriptive alt text and dimensions", () => {
    render(
      <PostMediaGallery
        media={[
          {
            id: "asset-1",
            url: "/api/media/media%2Fasset-1.png",
            mimeType: "image/png",
            byteSize: 123,
            width: 1200,
            height: 800,
            altText: "A mountain trail",
          },
        ]}
      />,
    );

    const image = screen.getByRole("img", { name: "A mountain trail" });
    expect(image).toHaveAttribute("width", "1200");
    expect(image).toHaveAttribute("height", "800");
    expect(screen.getByRole("link", { name: "Open image: A mountain trail" })).toHaveAttribute(
      "href",
      "/api/media/media%2Fasset-1.png",
    );
  });
});
