import type {
  GetStaticPaths,
  GetStaticPropsContext,
  InferGetStaticPropsType,
  NextPage,
} from "next";
import Head from "next/head";
import { ssgHelper } from "~/server/api/routers/ssgHelper";
import { api } from "~/utils/api";
import ErrorPage from "next/error";

const ProfilePage: NextPage<InferGetStaticPropsType<typeof getStaticProps>> = ({
  id,
}) => {
  const { data: profile } = api.profile.getById.useQuery({ id });

  if (profile == null || profile.name == null)
    return <ErrorPage statusCode={404} />;

  console.log(profile);

  return (
    <>
      <Head>
        <title>{`Twitter Clone ${profile.name}`}</title>
      </Head>
      {profile.name}
    </>
  );
};

// getStaticPaths is a function that retrieves and handles the static paths for the website
export const getStaticPaths: GetStaticPaths = () => {
  return {
    paths: [],
    fallback: "blocking",
  };
};

// getStaticProps is a function that fetches data and uses it for generating static website content.
export async function getStaticProps(
  context: GetStaticPropsContext<{ id: string }> // get id
) {
  const id = context.params?.id;

  // Check if id is present
  if (id == null) {
    return {
      redirect: {
        destination: "/",
      },
    };
  }

  // Initialize the ssg helper
  const ssg = ssgHelper();
  await ssg.profile.getById.prefetch({ id }); // Request profile data with the specified id

  return {
    props: {
      trpcState: ssg.dehydrate(), // Extract data from ssg id
      id,
    },
  };
}

export default ProfilePage;
