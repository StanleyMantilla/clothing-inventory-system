
const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Sale quantity must be a positive whole number."
      }
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "Unit price must be a finite number."
      }
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "Total amount must be a finite number."
      }
    },

    // Used later to recognize a repeated request.
    // Optional so existing sales remain compatible.
    idempotencyKey: {
      type: String,
      trim: true,
      minlength: 1,
      maxlength: 100,
      default: undefined,
      unique: true,
      sparse: true
    },

    soldAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

module.exports =
  mongoose.models.Sale ||
  mongoose.model("Sale", saleSchema);
