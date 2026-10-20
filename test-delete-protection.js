async function testDeleteProtection() {
  const productId = "6ad43aa3bf257a987d9d4de5";

  const response = await fetch(
    `http://localhost:5000/api/products/${productId}`,
    {
      method: "DELETE"
    }
  );

  const result = await response.json();

  console.log("Status:", response.status);
  console.log("Response:", result);

  if (response.status === 409) {
    console.log("PASS: Product with sales history is protected.");
  } else {
    console.log("Unexpected result. Check the response above.");
  }
}

testDeleteProtection().catch(console.error);