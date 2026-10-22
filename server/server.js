const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

require("dotenv").config({
  path: __dirname + "/.env"
});

const connectDB = require("./db");
const createAdmin = require("./createAdmin");

const {
  router: authRouter,
  authenticateToken,
  authorizeRoles
} = require("./routes/auth");

const Product = require("./models/Product");
const Sale = require("./models/Sale");
const aiRouter = require("./routes/aiRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Authentication and AI routes
app.use("/api/auth", authRouter);
app.use("/api/ai", aiRouter);

// Test route
app.get("/", (req, res) => {
  res.send("Clothing Inventory System API is running!");
});

// GET all products
app.get("/api/products", authenticateToken, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    console.error("Retrieve products error:", error.message);
    res.status(500).json({ message: "Failed to retrieve products." });
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
          message: "Threshold must be a non-negative whole number."
        });
      }

      const products = await Product.find({
        quantity: { $lte: threshold }
      }).sort({ quantity: 1 });

      res.status(200).json({
        message: "Low-stock products retrieved successfully!",
        threshold,
        count: products.length,
        products
      });
    } catch (error) {
      console.error("Low-stock error:", error.message);
      res.status(500).json({
        message: "Failed to retrieve low-stock products."
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
          message: "Threshold must be a non-negative whole number."
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
                $cond: [{ $lte: ["$quantity", threshold] }, 1, 0]
              }
            },
            inventoryCostValue: {
              $sum: { $multiply: ["$quantity", "$costPrice"] }
            },
            inventorySellingValue: {
              $sum: { $multiply: ["$quantity", "$sellingPrice"] }
            }
          }
        }
      ]);

      const summary = report[0] || {
        totalProducts: 0,
        totalStock: 0,
        lowStockProducts: 0,
        inventoryCostValue: 0,
        inventorySellingValue: 0
      };

      res.status(200).json({
        message: "Inventory report generated successfully!",
        threshold,
        report: summary
      });
    } catch (error) {
      console.error("Inventory report error:", error.message);
      res.status(500).json({
        message: "Failed to generate inventory report."
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
        sellingPrice
      } = req.body;

      if (
        !name ||
        !code ||
        !category ||
        !size ||
        !color ||
        quantity === undefined ||
        costPrice === undefined ||
        sellingPrice === undefined
      ) {
        return res.status(400).json({
          message: "Please complete all product fields."
        });
      }

      const newProduct = new Product({
        name,
        code,
        category,
        size,
        color,
        quantity,
        costPrice,
        sellingPrice
      });

      const savedProduct = await newProduct.save();

      res.status(201).json({
        message: "Clothing product added successfully!",
        product: savedProduct
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "Product code already exists."
        });
      }

      if (error.name === "ValidationError") {
        return res.status(400).json({ message: error.message });
      }

      console.error("Add product error:", error.message);
      res.status(500).json({ message: "Failed to add product." });
    }
  }
);

// GET search products by name or code
app.get("/api/products/search", authenticateToken, async (req, res) => {
  try {
    const search = String(req.query.q || "").trim();

    if (!search) {
      return res.status(400).json({
        message: "Please provide a search term using ?q="
      });
    }

    const products = await Product.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } }
      ]
    });

    res.status(200).json(products);
  } catch (error) {
    console.error("Product search error:", error.message);
    res.status(500).json({ message: "Product search failed." });
  }
});

// GET one product by ID
app.get("/api/products/:id", authenticateToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID." });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error("Retrieve product error:", error.message);
    res.status(500).json({ message: "Failed to retrieve product." });
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
        return res.status(400).json({ message: "Invalid product ID." });
      }

      const allowedFields = [
        "name",
        "code",
        "category",
        "size",
        "color",
        "quantity",
        "costPrice",
        "sellingPrice"
      ];

      const updates = {};

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          message: "Provide at least one field to update."
        });
      }

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({ message: "Product not found." });
      }

      res.status(200).json({
        message: "Product updated successfully!",
        product
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "Product code already exists."
        });
      }

      if (error.name === "ValidationError") {
        return res.status(400).json({ message: error.message });
      }

      console.error("Update product error:", error.message);
      res.status(500).json({ message: "Failed to update product." });
    }
  }
);

// DELETE: Remove a product
app.delete(
  "/api/products/:id",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid product ID." });
      }

      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({ message: "Product not found." });
      }

      const hasSales = await Sale.exists({ productId: product._id });

      if (hasSales) {
        return res.status(409).json({
          message: "Cannot delete a product with sales history."
        });
      }

      await product.deleteOne();

      res.status(200).json({
        message: "Product deleted successfully!"
      });
    } catch (error) {
      console.error("Delete product error:", error.message);
      res.status(500).json({ message: "Failed to delete product." });
    }
  }
);

// POST: Record a sale and reduce stock
app.post(
  "/api/sales",
  authenticateToken,
  authorizeRoles("admin", "staff"),
  async (req, res) => {
    try {
      const { productId, quantity } = req.body;

      if (
        !mongoose.isValidObjectId(productId) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1
      ) {
        return res.status(400).json({
          message:
            "Provide a valid product ID and positive whole-number quantity."
        });
      }

      const product = await Product.findOneAndUpdate(
        {
          _id: productId,
          quantity: { $gte: quantity }
        },
        { $inc: { quantity: -quantity } },
        { new: true }
      );

      if (!product) {
        const exists = await Product.exists({ _id: productId });

        return res.status(exists ? 400 : 404).json({
          message: exists ? "Insufficient stock." : "Product not found."
        });
      }

      try {
        const sale = await Sale.create({
          productId: product._id,
          quantity,
          unitPrice: product.sellingPrice,
          totalAmount: product.sellingPrice * quantity
        });

        return res.status(201).json({
          message: "Sale recorded successfully!",
          sale,
          remainingStock: product.quantity
        });
      } catch (error) {
        // Restore stock if saving the sale fails.
        try {
          const rollback = await Product.updateOne(
            {
              _id: product._id,
              quantity: { $lte: Number.MAX_SAFE_INTEGER - quantity }
            },
            { $inc: { quantity } }
          );

          if (rollback.modifiedCount !== 1) {
            console.error(
              "CRITICAL: Stock restoration did not succeed for product:",
              product._id.toString()
            );
          }
        } catch (rollbackError) {
          console.error(
            "CRITICAL: Stock restoration failed. Manual reconciliation may be required.",
            {
              productId: product._id.toString(),
              saleError: error.message,
              rollbackError: rollbackError.message
            }
          );
        }

        throw error;
      }
    } catch (error) {
      console.error("Record sale error:", error.message);
      res.status(500).json({ message: "Failed to record sale." });
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

      res.status(200).json(sales);
    } catch (error) {
      console.error("Retrieve sales error:", error.message);
      res.status(500).json({ message: "Failed to retrieve sales." });
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
        return res.status(400).json({ message: "Invalid sale ID." });
      }

      const sale = await Sale.findById(req.params.id)
        .populate("productId", "name code");

      if (!sale) {
        return res.status(404).json({ message: "Sale not found." });
      }

      res.status(200).json(sale);
    } catch (error) {
      console.error("Retrieve sale error:", error.message);
      res.status(500).json({ message: "Failed to retrieve sale." });
    }
  }
);

// Start the server after connecting to MongoDB
const PORT = process.env.PORT || 5000;

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

//Test