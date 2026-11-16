import mongoose, { Schema, model } from "mongoose";

const messageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { _id: false },
);

const aiConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "QuizSession", required: true },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    answer: { type: String, default: "" },
    messages: { type: [messageSchema], default: [] },
    feedback: {
      type: new Schema(
        {
          verdict: String,
          score: Number,
          summary: String,
          strengths: [String],
          missing: [String],
          model: String,
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true },
);

aiConversationSchema.index({ userId: 1, sessionId: 1, questionId: 1 });
aiConversationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const AiConversation = mongoose.models.AiConversation || model("AiConversation", aiConversationSchema);
