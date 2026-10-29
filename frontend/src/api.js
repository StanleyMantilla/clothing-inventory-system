const localApiUrl = "http://localhost:5000";
const deployedApiUrl = "https://clothstockbakend-dolv.onrender.com";

export const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? localApiUrl : deployedApiUrl)
).replace(/\/+$/, "");
