import type { NextPage } from "next";
import { useSession } from "next-auth/react";
import { useState } from "react";
import InfiniteTweetList from "~/components/InfiniteTweetList";
import NewTweetForm from "~/components/NewTweetForm";
import { api } from "~/utils/api";

const TABS = ["Recent", "Following"] as const;

const Home: NextPage = () => {
  const [selectedTab, setSelectedTab] =
    useState<(typeof TABS)[number]>("Recent");
  const session = useSession();

  return (
    <>
      <header className="sticky top-0 z-10 my-5 border-b bg-white">
        <h1 className="mb-2 px-4 text-lg font-bold">Home</h1>

        {/* it will render if auth and render set button */}
        {session.status == "authenticated" && (
          <div className="flex">
            {TABS.map((tab) => {
              return (
                <button
                  key={tab}
                  className={`flex-grow p-2 hover:bg-gray-200 focus-visible:bg-gray-200 ${
                    tab === selectedTab
                      ? "border-b-4 border-blue-500 font-bold"
                      : ""
                  }`}
                  onClick={() => setSelectedTab(tab)}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* NewTweetForm (make a tweet) */}
      <NewTweetForm />

      {/* for can see others tweets or you followiing */}
      {selectedTab === "Recent" ? <RecetTWeets /> : <FollowingTweets />}
    </>
  );
};

function RecetTWeets() {
  // fetch API for InfiniteTweetList, and doing some callback
  const tweets = api.tweet.infiniteFeed.useInfiniteQuery(
    {},
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  // and in here will be passing with props
  return (
    <InfiniteTweetList
      tweets={tweets.data?.pages.flatMap((page) => page.tweets)}
      isError={tweets.isError}
      isLoading={tweets.isLoading}
      hasMore={tweets.hasNextPage ?? false}
      fetchNewTweets={tweets.fetchNextPage}
    />
  );
}

function FollowingTweets() {
  // fetch API for InfiniteTweetList, and doing some callback
  const tweets = api.tweet.infiniteFeed.useInfiniteQuery(
    // Retrieves tweets only from accounts that are being followed
    { onlyFollowing: true },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );

  // and in here will be passing with props
  return (
    <InfiniteTweetList
      tweets={tweets.data?.pages.flatMap((page) => page.tweets)}
      isError={tweets.isError}
      isLoading={tweets.isLoading}
      hasMore={tweets.hasNextPage ?? false}
      fetchNewTweets={tweets.fetchNextPage}
    />
  );
}

export default Home;
