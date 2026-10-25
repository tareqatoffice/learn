// Length limits for the note a pending user leaves the admin. Kept apart from lib/access.ts
// so the client form can import them without pulling in Mongoose.
export const REQUEST_NOTE_MIN = 10;
export const REQUEST_NOTE_MAX = 500;
