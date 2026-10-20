
async function testValidation() {
  const tests = [
    {
      name: "Missing product fields",
      url: "http://localhost:5000/api/products",
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      },
      expectedStatus: 400
    },
    {
      name: "Empty product search",
      url: "http://localhost:5000/api/products/search",
      options: { method: "GET" },
      expectedStatus: 400
    },
    {
      name: "Invalid sale quantity",
      url: "http://localhost:5000/api/sales",
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: "6ad43aa3bf257a987d9d4de5",
          quantity: 0
        })
      },
      expectedStatus: 400
    }
  ];

  for (const test of tests) {
    const response = await fetch(test.url, test.options);
    const result = await response.json();

    console.log(
      `${test.name}: ${response.status} ${
        response.status === test.expectedStatus ? "PASS" : "FAIL"
      }`
    );

    console.log(result);
  }
}

testValidation().catch(console.error);
