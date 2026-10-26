const PersonKnowledge = require("../models/PersonKnowledge");
const mongoose = require("mongoose");

const personKnowledgeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    aliases: {
      type: [String],
      default: [],
      validate: [
        (arr) => arr.length <= 20,
        "A maximum of 20 aliases is allowed.",
      ],
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.PersonKnowledge ||
  mongoose.model("PersonKnowledge", personKnowledgeSchema);