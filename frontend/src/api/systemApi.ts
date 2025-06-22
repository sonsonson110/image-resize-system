import axios from "axios";

export const systemApi = {
  reset: async () => {
    const response = await axios.delete(
      import.meta.env.VITE_API_URL + "/reset"
    );
    return response.data;
  },
};
