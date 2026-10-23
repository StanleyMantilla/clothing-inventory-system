
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

require("dotenv").config({
  path: __dirname + "/.env",
});

const connectDB = require("./db");
const createAdmin = require("./createAdmin");

const {
  router: authRouter,
  authenticateToken,
  authorizeRoles,
} = require("./routes/auth");

const Product = require("./models/Product");
const Sale = require("./models/Sale");
const aiRouter = require("./routes/aiRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// Authentication and AI routes
app.use("/api/auth", authRouter);
app.use("/api/ai", aiRouter);

// Test route
app.get("/", (req, res) => {
  return res.status(200).send("Clothing Inventory System API is running!");
});

// GET all products
app.get("/api/products", authenticateToken, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    return res.status(200).json(products);
  } catch (error) {
    console.error("Retrieve products error:", error.message);
    return res.status(500).json({
      message: "Failed to retrieve products.",
    });
  }
});

// GET low-stock products (admin only)
app.get(
  "/api/products/low-stock",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const threshold = Number(req.query.threshold ?? 5);

      if (!Number.isSafeInteger(threshold) || threshold < 0) {
        return res.status(400).json({
          message: "Threshold must be a non-negative whole number.",
        });
      }

      const products = await Product.find({
        quantity: { $lte: threshold },
      }).sort({ quantity: 1 });

      return res.status(200).json({
        message: "Low-stock products retrieved successfully!",
        threshold,
        count: products.length,
        products,
      });
    } catch (error) {
      console.error("Low-stock error:", error.message);
      return res.status(500).json({
        message: "Failed to retrieve low-stock products.",
      });
    }
  }
);

// GET inventory report (admin only)
app.get(
  "/api/reports/inventory",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const threshold = Number(req.query.threshold ?? 5);

      if (!Number.isSafeInteger(threshold) || threshold < 0) {
        return res.status(400).json({
          message: "Threshold must be a non-negative whole number.",
        });
      }

      const report = await Product.aggregate([
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalStock: { $sum: "$quantity" },
            lowStockProducts: {
              $sum: {
                $cond: [{ $lte: ["$quantity", threshold] }, 1, 0],
              },
            },
            inventoryCostValue: {
              $sum: {
                $multiply: ["$quantity", "$costPrice"],
              },
            },
            inventorySellingValue: {
              $sum: {
                $multiply: ["$quantity", "$sellingPrice"],
              },
            },
          },
        },
        {
          $project: { _id: 0 },
        },
      ]);

      const summary = report[0] || {
        totalProducts: 0,
        totalStock: 0,
        lowStockProducts: 0,
        inventoryCostValue: 0,
        inventorySellingValue: 0,
      };

      return res.status(200).json({
        message: "Inventory report generated successfully!",
        threshold,
        report: summary,
      });
    } catch (error) {
      console.error("Inventory report error:", error.message);
      return res.status(500).json({
        message: "Failed to generate inventory report.",
      });
    }
  }
);

// POST: Add a new clothing product
app.post(
  "/api/products",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const {
        name,
        code,
        category,
        size,
        color,
        quantity,
        costPrice,
        sellingPrice,
      } = req.body;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof code !== "string" ||
        !code.trim() ||
        typeof category !== "string" ||
        !category.trim() ||
        typeof size !== "string" ||
        !size.trim() ||
        typeof color !== "string" ||
        !color.trim() ||
        quantity === undefined ||
        costPrice === undefined ||
        sellingPrice === undefined
      ) {
        return res.status(400).json({
          message: "Please complete all product fields.",
        });
      }

      const product = await Product.create({
        name: name.trim(),
        code: code.trim(),
        category: category.trim(),
        size: size.trim(),
        color: color.trim(),
        quantity,
        costPrice,
        sellingPrice,
      });

      return res.status(201).json({
        message: "Clothing product added successfully!",
        product,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "Product code already exists.",
        });
      }

      if (
        error.name === "ValidationError" ||
        error.name === "CastError"
      ) {
        return res.status(400).json({
          message: "Invalid product data. Check the values and try again.",
        });
      }

      console.error("Add product error:", error.message);
      return res.status(500).json({
        message: "Failed to add product.",
      });
    }
  }
);

// GET search products by name or code
app.get("/api/products/search", authenticateToken, async (req, res) => {
  try {
    const search = String(req.query.q || "").trim();

    if (!search) {
      return res.status(400).json({
        message: "Please provide a search term using ?q=",
      });
    }

    if (search.length > 100) {
      return res.status(400).json({
        message: "Search term is too long.",
      });
    }

    // Treat search input as literal text, not a regular expression.
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const products = await Product.find({
      $or: [
        { name: { $regex: escapedSearch, $options: "i" } },
        { code: { $regex: escapedSearch, $options: "i" } },
      ],
    }).sort({ name: 1 });

    return res.status(200).json(products);
  } catch (error) {
    console.error("Product search error:", error.message);
    return res.status(500).json({
      message: "Product search failed.",
    });
  }
});

// GET one product by ID
app.get("/api/products/:id", authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    return res.status(200).json(product);
  } catch (error) {
    console.error("Retrieve product error:", error.message);
    return res.status(500).json({
      message: "Failed to retrieve product.",
    });
  }
});

// PUT: Update an existing product
app.put(
  "/api/products/:id",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          message: "Invalid product ID.",
        });
      }

      const allowedFields = [
        "name",
        "code",
        "category",
        "size",
        "color",
        "quantity",
        "costPrice",
        "sellingPrice",
      ];

      const updates = {};

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          message: "Provide at least one field to update.",
        });
      }

      for (const field of ["name", "code", "category", "size", "color"]) {
        if (updates[field] !== undefined) {
          if (
            typeof updates[field] !== "string" ||
            !updates[field].trim()
          ) {
            return res.status(400).json({
              message: `${field} must be a non-empty string.`,
            });
          }

          updates[field] = updates[field].trim();
        }
      }

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!product) {
        return res.status(404).json({
          message: "Product not found.",
        });
      }

      return res.status(200).json({
        message: "Product updated successfully!",
        product,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "Product code already exists.",
        });
      }

      if (
        error.name === "ValidationError" ||
        error.name === "CastError"
      ) {
        return res.status(400).json({
          message: "Invalid product data. Check the values and try again.",
        });
      }

      console.error("Update product error:", error.message);
      return res.status(500).json({
        message: "Failed to update product.",
      });
    }
  }
);

// DELETE: Remove a product without sales history
app.delete(
  "/api/products/:id",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          message: "Invalid product ID.",
        });
      }

      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({
          message: "Product not found.",
        });
      }

      const hasSales = await Sale.exists({
        productId: product._id,
      });

      if (hasSales) {
        return res.status(409).json({
          message: "Cannot delete a product with sales history.",
        });
      }

      await product.deleteOne();

      return res.status(200).json({
        message: "Product deleted successfully!",
      });
    } catch (error) {
      console.error("Delete product error:", error.message);
      return res.status(500).json({
        message: "Failed to delete product.",
      });
    }
  }
);

// POST: Record a sale with idempotency protection
app.post(
  "/api/sales",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    // Keep these outside try so the catch block can access them.
    let idempotencyKey = null;
    let deductedProductId = null;
    let deductedQuantity = null;

    try {
      const { productId, quantity } = req.body;

      idempotencyKey = req.get("Idempotency-Key");

      // A unique key identifies one sale attempt, including retries.
      if (
        typeof idempotencyKey !== "string" ||
        !idempotencyKey.trim() ||
        idempotencyKey.length > 100 ||
        !/^[\x21-\x7E]+$/.test(idempotencyKey)
      ) {
        return res.status(400).json({
          message:
            "A valid Idempotency-Key header is required for each sale.",
        });
      }

      idempotencyKey = idempotencyKey.trim();

      if (
        typeof productId !== "string" ||
        !mongoose.isValidObjectId(productId) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1
      ) {
        return res.status(400).json({
          message:
            "Provide a valid product ID and positive whole-number quantity.",
        });
      }

      // If this key has already succeeded, return its original sale.
      const previousSale = await Sale.findOne({ idempotencyKey });

      if (previousSale) {
        const sameRequest =
          previousSale.productId.toString() === productId &&
          previousSale.quantity === quantity;

        if (!sameRequest) {
          return res.status(409).json({
            message:
              "This Idempotency-Key was already used for a different sale. Use a new key for a new sale.",
          });
        }

        return res.status(200).json({
          message: "This sale was already recorded.",
          sale: previousSale,
          replayed: true,
        });
      }

      // Atomically deduct stock only when enough is available.
      const product = await Product.findOneAndUpdate(
        {
          _id: productId,
          quantity: { $gte: quantity },
        },
        {
          $inc: { quantity: -quantity },
        },
        {
          new: true,
        }
      );

      if (!product) {
        const exists = await Product.exists({ _id: productId });

        return res.status(exists ? 400 : 404).json({
          message: exists ? "Insufficient stock." : "Product not found.",
        });
      }

      deductedProductId = product._id;
      deductedQuantity = quantity;

      const unitPrice = product.sellingPrice;
      const totalAmount = unitPrice * quantity;

      if (
        typeof unitPrice !== "number" ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0 ||
        !Number.isFinite(totalAmount) ||
        !Number.isSafeInteger(Math.round(totalAmount * 100))
      ) {
        throw new Error("Invalid product price or sale total.");
      }

      const sale = await Sale.create({
        productId: product._id,
        quantity,
        unitPrice,
        totalAmount,
        idempotencyKey,
      });

      // Sale saved successfully; no rollback is needed.
      deductedProductId = null;
      deductedQuantity = null;

      return res.status(201).json({
        message: "Sale recorded successfully!",
        sale,
        remainingStock: product.quantity,
        replayed: false,
      });
    } catch (error) {
      // Another concurrent request may have saved the same unique key.
      if (error.code === 11000 && idempotencyKey) {
        if (deductedProductId && deductedQuantity !== null) {
          try {
            const rollback = await Product.updateOne(
              {
                _id: deductedProductId,
                quantity: {
                  $lte: Number.MAX_SAFE_INTEGER - deductedQuantity,
                },
              },
              {
                $inc: { quantity: deductedQuantity },
              }
            );

            if (rollback.modifiedCount !== 1) {
              console.error(
                "CRITICAL: Could not restore stock after duplicate sale request.",
                {
                  productId: deductedProductId.toString(),
                  quantity: deductedQuantity,
                }
              );

              return res.status(500).json({
                message:
                  "A duplicate sale request was detected, but stock restoration needs to be checked.",
              });
            }

            deductedProductId = null;
            deductedQuantity = null;
          } catch (rollbackError) {
            console.error("CRITICAL: Duplicate-sale rollback failed.", {
              productId: deductedProductId.toString(),
              quantity: deductedQuantity,
              rollbackError: rollbackError.message,
            });

            return res.status(500).json({
              message:
                "Stock restoration failed. Check stock and sales history before retrying.",
            });
          }
        }

        try {
          const existingSale = await Sale.findOne({ idempotencyKey });

          if (existingSale) {
            const sameRequest =
              existingSale.productId.toString() === productId &&
              existingSale.quantity === quantity;

            if (!sameRequest) {
              return res.status(409).json({
                message:
                  "This Idempotency-Key was already used for a different sale. Use a new key for a new sale.",
              });
            }

            return res.status(200).json({
              message: "This sale was already recorded.",
              sale: existingSale,
              replayed: true,
            });
          }
        } catch (lookupError) {
          console.error(
            "Could not verify duplicate sale request:",
            lookupError.message
          );
        }
      }

      // Best-effort rollback if an error occurred after stock deduction.
      if (deductedProductId && deductedQuantity !== null) {
        try {
          const rollback = await Product.updateOne(
            {
              _id: deductedProductId,
              quantity: {
                $lte: Number.MAX_SAFE_INTEGER - deductedQuantity,
              },
            },
            {
              $inc: { quantity: deductedQuantity },
            }
          );

          if (rollback.modifiedCount !== 1) {
            console.error("CRITICAL: Stock restoration did not succeed.", {
              productId: deductedProductId.toString(),
              quantity: deductedQuantity,
            });
          }
        } catch (rollbackError) {
          console.error(
            "CRITICAL: Stock restoration failed; reconciliation is required.",
            {
              productId: deductedProductId.toString(),
              quantity: deductedQuantity,
              saleError: error.message,
              rollbackError: rollbackError.message,
            }
          );
        }
      }

      console.error("Record sale error:", error.message);

      return res.status(500).json({
        message:
          "Failed to record sale. Verify the stock and sales history before retrying.",
      });
    }
  }
);

// GET all sales — administrators and staff
app.get(
  "/api/sales",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const sales = await Sale.find()
        .populate("productId", "name code")
        .sort({ soldAt: -1 });

      return res.status(200).json(sales);
    } catch (error) {
      console.error("Retrieve sales error:", error.message);
      return res.status(500).json({
        message: "Failed to retrieve sales.",
      });
    }
  }
);

// GET one sale by ID
app.get(
  "/api/sales/:id",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          message: "Invalid sale ID.",
        });
      }

      const sale = await Sale.findById(req.params.id).populate(
        "productId",
        "name code"
      );

      if (!sale) {
        return res.status(404).json({
          message: "Sale not found.",
        });
      }

      return res.status(200).json(sale);
    } catch (error) {
      console.error("Retrieve sale error:", error.message);
      return res.status(500).json({
        message: "Failed to retrieve sale.",
      });
    }
  }
);

// Handle malformed JSON requests
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      message: "Invalid JSON request body.",
    });
  }

  return next(error);
});

// Start server after connecting to MongoDB
async function startServer() {
  try {
    await connectDB();
    await createAdmin();

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
  }
}

startServer();
