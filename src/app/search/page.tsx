"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import LoadingSpinner from "~/components/LoadingSpinner";
import ProfileImage from "~/components/ProfileImage";
import TweetCard from "~/components/TweetCard";
import { api } from "~/utils/api";

export default function SearchPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const results = api.search.all.useQuery({ q: query }, { enabled: query.length >= 2 });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = input.trim();
    if (nextQuery.length < 2) return;
    setQuery(nextQuery);
  }

  return (
    <main>
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-4">
        <h1 className="text-lg font-bold">Search</h1>
        <form className="mt-3 flex gap-2" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="search-query">
            Search posts and people
          </label>
          <input
            id="search-query"
            className="min-w-0 flex-grow rounded-full border border-slate-300 px-4 py-2 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            value={input}
            minLength={2}
            maxLength={80}
            placeholder="Search posts and people"
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            type="submit"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Search
          </button>
        </form>
      </header>

      {query.length < 2 && (
        <p className="px-4 py-8 text-center text-slate-600">Search for at least two characters.</p>
      )}
      {results.isLoading && <LoadingSpinner />}
      {results.isError && (
        <p role="alert" className="px-4 py-8 text-center text-red-700">
          Search is unavailable right now.
        </p>
      )}
      {results.data != null && (
        <div aria-live="polite">
          <section aria-labelledby="people-heading">
            <h2 id="people-heading" className="border-b px-4 py-4 font-semibold">
              People
            </h2>
            {results.data.users.length === 0 ? (
              <p className="border-b px-4 py-4 text-sm text-slate-600">No matching people.</p>
            ) : (
              <ul className="border-b">
                {results.data.users.map((user) => (
                  <li key={user.id} className="border-b px-4 py-3 last:border-b-0">
                    <Link
                      href={`/profiles/${user.id}`}
                      className="flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                    >
                      <ProfileImage src={user.image} />
                      <span className="min-w-0">
                        <strong className="block truncate">{user.name}</strong>
                        {user.bio != null && (
                          <span className="block truncate text-sm text-slate-600">{user.bio}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="posts-heading">
            <h2 id="posts-heading" className="border-b px-4 py-4 font-semibold">
              Posts
            </h2>
            {results.data.tweets.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-600">No matching posts.</p>
            ) : (
              <ul>
                {results.data.tweets.map((tweet) => (
                  <TweetCard key={tweet.id} {...tweet} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
