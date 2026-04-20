import { db } from "~/db";
import { accountModel } from "~/server/db/account-model";
import { authenticatorModel } from "~/server/db/authenticator-model";
import { likeModel } from "~/server/db/like-model";
import { sessionModel } from "~/server/db/session-model";
import { tweetModel } from "~/server/db/tweet-model";
import { userModel } from "~/server/db/user-model";
import { verificationTokenModel } from "~/server/db/verification-token-model";

export const prisma = {
  user: userModel,
  tweet: tweetModel,
  like: likeModel,
  account: accountModel,
  session: sessionModel,
  verificationToken: verificationTokenModel,
  authenticator: authenticatorModel,
};

export { db };
