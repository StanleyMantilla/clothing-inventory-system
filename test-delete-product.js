
async function testDeleteProduct() {
  // Intentionally invalid ID: this must not delete anything.
  const productId = "invalid-id";

  const response = await fetch(
    `http://localhost:5000/api/products/${productId}`,
    {
      method: "DELETE"
    }
  );

  const result = await response.json();

  console.log("Status:", response.status);
  console.log("Response:", result);
}

testDeleteProduct().catch(console.error);
