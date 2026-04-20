import { fireEvent, render, screen } from "@testing-library/react";
import Home from "~/app/page";

type InfiniteQueryResult = {
  data: {
    pages: Array<{
      tweets: Array<{ id: string; content: string; createdAt: Date }>;
      nextCursor: null;
    }>;
  };
  isError: boolean;
  isLoading: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
};

const useInfiniteQuerySpy =
  vi.fn<(input?: { onlyFollowing?: boolean }) => InfiniteQueryResult>();

vi.mock("~/lib/auth/client", () => ({
  useSession: () => ({
    status: "authenticated",
    data: { user: { id: "user-1" } },
  }),
}));

vi.mock("~/components/NewTweetForm", () => ({
  default: () => <div data-testid="new-tweet-form">new tweet form</div>,
}));

vi.mock("~/components/InfiniteTweetList", () => ({
  default: ({
    tweets,
  }: {
    tweets?: Array<{ id: string; content: string; createdAt: Date }>;
  }) => (
    <div data-testid="tweet-list">
      {(tweets ?? []).map((tweet) => (
        <span key={tweet.id}>{tweet.content}</span>
      ))}
    </div>
  ),
}));

vi.mock("~/utils/api", () => ({
  api: {
    tweet: {
      infiniteFeed: {
        useInfiniteQuery: (input?: { onlyFollowing?: boolean }) =>
          useInfiniteQuerySpy(input),
      },
    },
  },
}));

describe("src/app/page.tsx", () => {
  it("renders authenticated tabs and switches tweet feeds", () => {
    useInfiniteQuerySpy.mockImplementation((input) => ({
      data: {
        pages: [
          {
            tweets: [
              {
                id: input?.onlyFollowing ? "following-1" : "recent-1",
                content: input?.onlyFollowing
                  ? "Following tweet"
                  : "Recent tweet",
                createdAt: new Date("2024-01-01T00:00:00.000Z"),
              },
            ],
            nextCursor: null,
          },
        ],
      },
      isError: false,
      isLoading: false,
      hasNextPage: false,
      fetchNextPage: async () => undefined,
    }));

    render(<Home />);

    expect(screen.getByRole("button", { name: "Recent" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Following" })
    ).toBeInTheDocument();
    expect(screen.getByText("Recent tweet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Following" }));

    expect(screen.getByText("Following tweet")).toBeInTheDocument();
    expect(useInfiniteQuerySpy).toHaveBeenCalledWith({ onlyFollowing: true });
  });
});
