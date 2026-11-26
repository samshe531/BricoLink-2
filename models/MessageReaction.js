const mongoose = require("mongoose");

const messageReactionSchema = new mongoose.Schema(
  {
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DirectMessage",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

messageReactionSchema.index({ message: 1, user: 1 }, { unique: true });

module.exports =
  mongoose.models.MessageReaction ||
  mongoose.model("MessageReaction", messageReactionSchema);
