import Link from "next/link";
import { useSession } from "next-auth/react";

export function SideNav() {
  const session = useSession();
  const user = session.data?.user; // cek session user data
  console.log(user);
  return (
    <nav className="sticky top-0 px-2 py-4">
      <ul className="flex flex-col items-center gap-2 whitespace-nowrap">
        <li>
          <Link href={"/"}>Home</Link>
        </li>
        {/* with user not null, will see this */}
        {user != null && (
          <li>
            <Link href={`/profiles/${user.id}`}>Profiles</Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
