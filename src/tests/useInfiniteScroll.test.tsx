import { act, render, screen, waitFor } from "@testing-library/react";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";

const fetchNewTweets = vi.fn<() => Promise<unknown>>();
const observeSpy = vi.fn();
const disconnectSpy = vi.fn();
let latestIntersectionCallback: IntersectionObserverCallback | undefined;

function HookHarness() {
  const { loadMoreRef, isFetchingMore } = useInfiniteScroll({
    enabled: true,
    fetchMore: fetchNewTweets,
    hasMore: true,
    rootMargin: "200px 0px",
  });

  return (
    <div>
      <div ref={loadMoreRef} data-testid="sentinel" />
      {isFetchingMore && <span>Fetching more</span>}
    </div>
  );
}

describe("src/hooks/useInfiniteScroll.ts", () => {
  beforeEach(() => {
    fetchNewTweets.mockReset();
    observeSpy.mockReset();
    disconnectSpy.mockReset();
    latestIntersectionCallback = undefined;

    class MockIntersectionObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds = [];

      constructor(callback: IntersectionObserverCallback) {
        latestIntersectionCallback = callback;
      }

      disconnect = disconnectSpy;
      observe = observeSpy;
      takeRecords = () => [];
      unobserve = vi.fn();
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("observes the sentinel, fetches on intersection, and disconnects on unmount", async () => {
    let resolveFetch: (() => void) | undefined;
    fetchNewTweets.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const { unmount } = render(<HookHarness />);

    expect(observeSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Fetching more")).not.toBeInTheDocument();

    await act(async () => {
      await latestIntersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(fetchNewTweets).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Fetching more")).toBeInTheDocument();

    await act(async () => {
      resolveFetch?.();
    });

    await waitFor(() => {
      expect(screen.queryByText("Fetching more")).not.toBeInTheDocument();
    });

    unmount();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
