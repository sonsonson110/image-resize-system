import { apiClient } from "../lib/axios";

export const imageApi = {
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);

    const response = await apiClient.post("/images/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  },
};
