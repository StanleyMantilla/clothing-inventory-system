
const mongoose = require("mongoose");

// Reuse the existing application models.
const Product =
  mongoose.models.Product || require("./Product");

const Sale =
  mongoose.models.Sale || require("./Sale");

// Store conversations, messages, and optional AI results.
const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      default: "New conversation",
    },

    messages: [
      {
        role: {
          type: String,
          enum: ["user", "assistant"],
          required: true,
        },

        content: {
          type: String,
          required: true,
          maxlength: 10000,
        },

        // Optional structured results for restoring older chats.
        results: {
          type: mongoose.Schema.Types.Mixed,
          default: undefined,
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Avoid recompiling the model when the server reloads.
const Conversation =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

module.exports = {
  Product,
  Sale,
  Conversation,
};
