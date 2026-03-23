import { render } from "@testing-library/react";
import InfiniteTweetList from "~/components/InfiniteTweetList";

const fetchNewTweets = vi.fn<() => Promise<unknown>>();
const observeSpy = vi.fn();
const disconnectSpy = vi.fn();
let latestIntersectionCallback: IntersectionObserverCallback | undefined;

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    status: "authenticated",
    data: { user: { id: "user-1" } },
  }),
}));

vi.mock("~/components/ProfileImage", () => ({
  default: () => <div data-testid="profile-image" />,
}));

vi.mock("~/components/IconHoverEffect", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("~/components/LoadingSpinner", () => ({
  default: () => <div data-testid="loading-spinner" />,
}));

vi.mock("~/utils/api", () => ({
  api: {
    useContext: () => ({
      tweet: {
        infiniteFeed: { setInfiniteData: vi.fn() },
        infiteProfile: { setInfiniteData: vi.fn() },
      },
    }),
    tweet: {
      toggleLike: {
        useMutation: () => ({ isPending: false, mutate: vi.fn() }),
      },
    },
  },
}));

describe("src/components/InfiniteTweetList.tsx", () => {
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

  it("fetches the next page when the load trigger intersects", async () => {
    render(
      <InfiniteTweetList
        tweets={[
          {
            id: "tweet-1",
            content: "Hello world",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
            likeCount: 1,
            likedByMe: false,
            user: { id: "user-2", image: null, name: "Ada" },
          },
        ]}
        isError={false}
        isLoading={false}
        hasMore
        fetchNewTweets={fetchNewTweets}
      />
    );

    expect(observeSpy).toHaveBeenCalledTimes(1);
    expect(latestIntersectionCallback).toBeDefined();

    await latestIntersectionCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );

    expect(fetchNewTweets).toHaveBeenCalledTimes(1);
  });
});
