// Length limits shared by the access forms and the server checks. Kept apart from lib/access.ts
// so client components can import them without pulling in Mongoose.

/** The note a pending user leaves the admin. */
export const REQUEST_NOTE_MIN = 10;
export const REQUEST_NOTE_MAX = 500;

/** The reason an admin gives when blocking someone. */
export const BLOCK_REASON_MAX = 300;
