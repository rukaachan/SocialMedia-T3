import Button from "./Button";
import ProfileImage from "./ProfileImage";
import type { FormEvent } from "react";
import { useState } from "react";
import { useAutoResizeTextArea } from "~/hooks/useAutoResizeTextArea";
import { useSession } from "~/lib/auth/client";
import { api } from "~/utils/api";

export default function NewTweetForm() {
  const session = useSession();

  if (session.status !== "authenticated") return null;

  return <Form />;
}

function Form() {
  const session = useSession();
  const [inputValue, setInputValue] = useState("");
  const inputRef = useAutoResizeTextArea(inputValue);

  const trcpcUtils = api.useContext();

  // for manage api, are they success or not
  const createTweet = api.tweet.create.useMutation({
    // will take param newTweet
    onSuccess: (newTweet) => {
      setInputValue("");

      setInputValue("");

      // checking session
      if (session.status !== "authenticated") return;

      // for updating, with no reload after click heart
      trcpcUtils.tweet.infiniteFeed.setInfiniteData({}, (oldData) => {
        // checking callback oldData
        if (oldData == null || oldData.pages[0] == null) return;

        // catch the new tweet, and replace it
        const newCatchTweet = {
          ...newTweet,
          likeCount: 0,
          likedByMe: false,
          user: {
            id: session.data.user.id,
            name: session.data.user.name || null,
            image: session.data.user.image || null,
          },
        };

        // and doing some return for view
        return {
          ...oldData,
          pages: [
            {
              ...oldData.pages[0],
              tweets: [newCatchTweet, ...oldData.pages[0].tweets],
            },
            ...oldData.pages.slice(1),
          ],
        };
      });
    },
  });

  // handle on submit
  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // do nothing if value empty
    if (!inputValue.trim()) return;

    // mutate with content of value from inputValue
    createTweet.mutate({ content: inputValue });
  }

  if (session.status !== "authenticated") return;

  return (
    <form className="flex flex-col gap-2 border-b px-4" onSubmit={handleSubmit}>
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
