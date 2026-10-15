
async function testAddProduct() {
  try {
    const response = await fetch(
      "http://localhost:5000/api/products",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: "Basic T-Shirt",
          code: "TS-001",
          category: "T-Shirt",
          size: "M",
          color: "Black",
          quantity: 25,
          costPrice: 150,
          sellingPrice: 250
        })
      }
    );

    const result = await response.json();

    console.log("Status:", response.status);
    console.log("Response:", result);
  } catch (error) {
    console.log("Error:", error.message);
  }
}

testAddProduct();
