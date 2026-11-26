const mongoose = require("mongoose");

const publicationCommentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

const photoCommentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

const publicationPhotoCommentsSchema = new mongoose.Schema(
  {
    imageIndex: {
      type: Number,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    comments: {
      type: [photoCommentSchema],
      default: [],
    },
  },
  { _id: false }
);

const publicationSchema = new mongoose.Schema(
  {
    professional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Professional",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    images: {
      type: [String],
      default: [],
    },
    image: {
      type: String,
      default: "",
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: {
      type: [publicationCommentSchema],
      default: [],
    },
    photoComments: {
      type: [publicationPhotoCommentsSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.Publication || mongoose.model("Publication", publicationSchema);
