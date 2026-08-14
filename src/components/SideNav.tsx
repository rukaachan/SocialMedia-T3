"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import IconHoverEffect from "./IconHoverEffect";
import {
  VscAccount,
  VscBookmark,
  VscHome,
  VscSearch,
  VscSettingsGear,
  VscSignIn,
  VscSignOut,
} from "react-icons/vsc";
import { authClient, useSession } from "~/lib/auth/client";

export function SideNav() {
  const session = useSession();
  const router = useRouter();
  const user = session.data?.user;
  return (
    <nav className="sticky top-0 px-2 py-4">
      <ul className="flex flex-col items-center gap-2 whitespace-nowrap">
        <li>
          <Link
            href="/"
            aria-label="Home"
            className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <IconHoverEffect>
              <span className="flex items-center gap-4">
                <VscHome className="h-8 w-8" />
                <span className="hidden text-lg md:inline">Home</span>
              </span>
            </IconHoverEffect>
          </Link>
        </li>

        <li>
          <Link
            href="/search"
            aria-label="Search"
            className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <IconHoverEffect>
              <span className="flex items-center gap-4">
                <VscSearch className="h-8 w-8" />
                <span className="hidden text-lg md:inline">Search</span>
              </span>
            </IconHoverEffect>
          </Link>
        </li>

        {/* with user not null, will see this */}
        {user != null && (
          <li>
            <Link
              href={`/profiles/${user.id}`}
              aria-label="Profile"
              className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <IconHoverEffect>
                <span className="flex items-center gap-4">
                  <VscAccount className="h-8 w-8" />
                  <span className="hidden text-lg md:inline">Profile</span>
                </span>
              </IconHoverEffect>
            </Link>
          </li>
        )}
        {user != null && (
          <>
            <li>
              <Link
                href="/bookmarks"
                aria-label="Bookmarks"
                className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <IconHoverEffect>
                  <span className="flex items-center gap-4">
                    <VscBookmark className="h-8 w-8" />
                    <span className="hidden text-lg md:inline">Bookmarks</span>
                  </span>
                </IconHoverEffect>
              </Link>
            </li>
            <li>
              <Link
                href="/settings"
                aria-label="Settings"
                className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <IconHoverEffect>
                  <span className="flex items-center gap-4">
                    <VscSettingsGear className="h-8 w-8" />
                    <span className="hidden text-lg md:inline">Settings</span>
                  </span>
                </IconHoverEffect>
              </Link>
            </li>
          </>
        )}
        {user == null ? (
          <li>
            <Link
              href="/auth/sign-in"
              aria-label="Log in"
              className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <IconHoverEffect>
                <span className="flex items-center gap-4">
                  <VscSignIn className="h-8 w-8 fill-green-700" />
                  <span className="hidden fill-green-700 text-lg md:inline">Log In</span>
                </span>
              </IconHoverEffect>
            </Link>
          </li>
        ) : (
          <li>
            <button
              type="button"
              aria-label="Log out"
              className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              onClick={() =>
                void authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      router.push("/");
                    },
                  },
                })
              }
            >
              <IconHoverEffect>
                <span className="flex items-center gap-4">
                  <VscSignOut className="h-8 w-8 fill-red-700" />
                  <span className="hidden fill-red-700 text-lg md:inline">Log Out</span>
                </span>
              </IconHoverEffect>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
