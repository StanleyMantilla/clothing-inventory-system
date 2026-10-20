
async function testUpdateProduct() {
  // Replace this with an existing product's actual MongoDB _id
  const productId = "6ad43aa3bf257a987d9d4de5";

  const response = await fetch(
    `http://localhost:5000/api/products/${productId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Basic T-Shirt"
      })
    }
  );

  const result = await response.json();

  console.log("Status:", response.status);
  console.log("Response:", result);
}

testUpdateProduct().catch(console.error);
