"use client";

import Link from "next/link";
import { api } from "~/utils/api";
import ErrorPage from "next/error";
import IconHoverEffect from "~/components/IconHoverEffect";
import { VscArrowLeft } from "react-icons/vsc";
import ProfileImage from "~/components/ProfileImage";
import LoadingSpinner from "~/components/LoadingSpinner";
import InfiniteTweetList from "~/components/InfiniteTweetList";
import Button from "~/components/Button";
import { useSession } from "~/lib/auth/client";

const pluralRules = new Intl.PluralRules();
function getPlural(number: number, singular: string, plural: string) {
  return pluralRules.select(number) === "one" ? singular : plural;
}

export default function ProfilePage({ params }: { params: { id: string } }) {
  const id = params.id;
  const session = useSession();
  const {
    data: profile,
    isLoading: profileIsLoading,
    isError: profileIsError,
  } = api.profile.getById.useQuery({ id });
  const tweets = api.tweet.infiteProfile.useInfiniteQuery(
    { userId: id },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );

  const trpcUtils = api.useContext(); // to allows access the value

  const toggleFollow = api.profile.toggleFollow.useMutation({
    // update the profile data after a sucessful follow or unfollow
    onSuccess: ({ addedFollow }) => {
      trpcUtils.profile.getById.setData({ id }, (oldData) => {
        if (oldData == null) return;

        const countModifier = addedFollow ? 1 : -1;

        return {
          ...oldData,
          isFollowing: addedFollow,
          followersCount: oldData.followersCount + countModifier,
        };
      });
    },
  });

  if (profileIsLoading) return <LoadingSpinner />;
  if (profileIsError) {
    return <p className="px-4 py-8 text-center text-red-700">Profile could not be loaded.</p>;
  }
  if (profile == null || profile.name == null) return <ErrorPage statusCode={404} />;

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center border-b bg-white px-4 py-2">
        <Link
          href="/"
          aria-label="Back to home"
          className="mr-2 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <IconHoverEffect>
            <VscArrowLeft className="h-6 w-6" />
          </IconHoverEffect>
        </Link>
        <ProfileImage
          src={profile.image}
          alt={`${profile.name} avatar`}
          className="flex-shrink-0"
        />
        <div className="ml-2 flex-grow">
          <h1 className="text-lg font-bold">{profile.name}</h1>
          {profile.bio != null && profile.bio.length > 0 && (
            <p className="mt-1 max-w-xl whitespace-pre-wrap text-sm text-slate-600">
              {profile.bio}
            </p>
          )}
          <div className="text-gray-500">
            {profile.tweetsCount} {getPlural(profile.tweetsCount, "Tweet", "Tweets")} -{" "}
            {profile.followersCount} {getPlural(profile.followersCount, "Follower", "Followers")} -{" "}
            {profile.followsCount} Following
          </div>
        </div>
        {session.status === "authenticated" && session.data.user.id === id ? (
          <Link
            href="/settings"
            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Edit profile
          </Link>
        ) : (
          <FollowButton
            isFollowing={profile.isFollowing}
            isLoading={toggleFollow.isPending}
            userId={id}
            onClick={() => toggleFollow.mutate({ userId: id })}
            isError={toggleFollow.isError}
          />
        )}
      </header>
      <main>
        <InfiniteTweetList
          tweets={tweets.data?.pages.flatMap((page) => page.tweets)}
          isError={tweets.isError}
          isLoading={tweets.isLoading}
          hasMore={tweets.hasNextPage ?? false}
          fetchNewTweets={tweets.fetchNextPage}
        />
      </main>
    </>
  );
}

function FollowButton({
  userId,
  isFollowing,
  isLoading,
  onClick,
  isError,
}: {
  userId: string;
  isFollowing: boolean;
  isLoading: boolean;
  onClick: () => void;
  isError: boolean;
}) {
  const session = useSession();
  if (session.status !== "authenticated" || session.data.user.id === userId) return null;

  return (
    <span className="flex items-center gap-2">
      <Button onClick={onClick} small gray={isFollowing} disabled={isLoading}>
        {isFollowing ? "Unfollow" : "Follow"}
      </Button>
      {isError && (
        <span role="alert" className="text-xs text-red-700">
          Could not update
        </span>
      )}
    </span>
  );
}
