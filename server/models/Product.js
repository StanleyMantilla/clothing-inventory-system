
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      unique: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    size: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    color: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Quantity must be a non-negative whole number.",
      },
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "Cost price must be a finite number.",
      },
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "Selling price must be a finite number.",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Product ||
  mongoose.model("Product", productSchema);
