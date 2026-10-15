const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config({ path: __dirname + "/.env" });

const connectDB = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

// Product database structure
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  size: { type: String, required: true },
  color: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 }
}, { timestamps: true });

// Sales database structure
const saleSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  soldAt: { type: Date, default: Date.now }
});

const Product = mongoose.model("Product", productSchema);
const Sale = mongoose.model("Sale", saleSchema);

// Test route
app.get("/", (req, res) => {
  res.send("Clothing Inventory System API is running!");
});

// GET all products
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve products." });
  }
});

 // POST: Add a new clothing product
app.post("/api/products", async (req, res) => {
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

    // Check required fields
    if (
      !name || !code || !category || !size || !color ||
      quantity === undefined ||
      costPrice === undefined ||
      sellingPrice === undefined
    ) {
      return res.status(400).json({
        message: "Please complete all product fields."
      });
    }

    // Create a new product
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

    // Save the product to MongoDB
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
      return res.status(400).json({
        message: error.message
      });
    }

    console.error("Add product error:", error);

    res.status(500).json({
      message: "Failed to add product."
    });
  }
});


// GET one product by ID
app.get("/api/products/:id", async (req, res) => {
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
    res.status(500).json({ message: "Failed to retrieve product." });
  }
});

// GET search products by name or code
app.get("/api/products/search", async (req, res) => {
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
    res.status(500).json({ message: "Product search failed." });
  }
});

// GET all sales
app.get("/api/sales", async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate("productId", "name code")
      .sort({ soldAt: -1 });

    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve sales." });
  }
});

// GET one sale by ID
app.get("/api/sales/:id", async (req, res) => {
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
    res.status(500).json({ message: "Failed to retrieve sale." });
  }
});

// Start the server after connecting to MongoDB
const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();

//Test