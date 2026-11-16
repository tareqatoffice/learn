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
