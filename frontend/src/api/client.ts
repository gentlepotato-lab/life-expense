import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.MODE === "development"
      ? ""
      : "/",
});

export default api;