
async function testSale() {
  const productId = "6ad43aa3bf257a987d9d4de5";

  const response = await fetch("http://localhost:5000/api/sales", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      productId,
      quantity: 1
    })
  });

  const result = await response.json();

  console.log("Status:", response.status);
  console.log("Response:", result);
}

testSale().catch(console.error);
