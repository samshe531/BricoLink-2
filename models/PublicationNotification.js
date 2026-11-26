const mongoose = require("mongoose");

const publicationNotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    publication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Publication",
      required: true,
    },
    professional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Professional",
      required: true,
    },
    type: {
      type: String,
      enum: ["like"],
      default: "like",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

publicationNotificationSchema.index(
  { recipient: 1, actor: 1, publication: 1, type: 1 },
  { unique: true }
);

module.exports =
  mongoose.models.PublicationNotification ||
  mongoose.model("PublicationNotification", publicationNotificationSchema);
