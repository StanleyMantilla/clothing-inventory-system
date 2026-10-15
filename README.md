# Clothing Inventory System BSIT 3-C 

## 📌 About the Project

The **Clothing Inventory System** is a web-based application designed to help manage clothing products, monitor stock quantities, and record sales. It aims to make clothing inventory management more organized, accurate, and efficient.

## 🎯 Objectives

- Manage clothing product records.
- Track available stock quantities.
- Store product information, including name, code, category, size, and color.
- Record product cost prices and selling prices.
- Manage and review sales records.
- Store inventory and sales data in a database.

## ✨ Features

- **Product Management** – Store and retrieve clothing product information.
- **Stock Monitoring** – Track the available quantity of each product.
- **Product Search** – Search products by name or product code.
- **Sales Records** – Store and retrieve sales information.
- **Database Integration** – Use MongoDB to store product and sales data.
- **REST API** – Use Express.js to handle requests from the application.

*Note: Features may be updated as development continues.*

## 🛠️ Technologies Used

- JavaScript
- Node.js
- Express.js
- MongoDB
- Mongoose
- CORS
- dotenv
- Nodemon

## 📂 Project Structure

```text
clothing-inventory-system/
├── server/
│   ├── server.js
│   ├── db.js
│   └── .env
├── package.json
├── package-lock.json
├── .gitignore
└── test-product.js
```

*The `.env` file is used for local configuration and should never be uploaded to GitHub.*

## ⚙️ Installation and Setup

### Prerequisites

- Node.js and npm
- MongoDB or a MongoDB Atlas account
- Git
- Visual Studio Code

### 1. Clone the Repository

```bash
git clone https://github.com/StanleyMantilla/clothing-inventory-system.git
```

### 2. Open the Project Folder

```bash
cd clothing-inventory-system
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create the appropriate `.env` file in the location expected by the backend. Add your MongoDB connection string and any required configuration.

Never share your database password or commit your `.env` file to GitHub.

### 5. Start the Development Server

```bash
npm run dev
```

If the setup is correct, the backend API should start on the configured port.

## 🔗 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Check whether the API is running |
| GET | `/api/products` | Retrieve all products |
| GET | `/api/products/:id` | Retrieve a product by ID |
| GET | `/api/products/search?q=shirt` | Search products by name or code |
| GET | `/api/sales` | Retrieve all sales |
| GET | `/api/sales/:id` | Retrieve a sale by ID |
| POST | `/api/products` | Add a new product |

## 🚧 Project Status

**In Development**

This project is currently being developed, tested, and improved. More features may be added in future updates.

## 👨‍💻 Developer

**Stanley Mantilla**

GitHub: [@StanleyMantilla](https://github.com/StanleyMantilla)
