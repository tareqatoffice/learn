/**
 * What a mocked `auth()` returns for `userId`, after making sure an approved user document exists:
 * requireUser() re-reads the access status from the database, so a session for a user the test
 * never created would be redirected like a deleted account. Imported lazily from vi.mock factories.
 */
export async function approvedSession(userId: string | null, email = "learner@example.test") {
  if (!userId) return null;
  const { User } = await import("@/models");
  await User.updateOne(
    { _id: userId },
    { $setOnInsert: { email: `${userId}@example.test`, name: "Learner", status: "approved", lastLoginAt: new Date() } },
    { upsert: true },
  );
  return { user: { id: userId, email, name: "Learner" } };
}
