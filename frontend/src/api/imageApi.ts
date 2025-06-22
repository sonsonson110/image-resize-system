import { apiClient } from "../lib/axios";
import type { ImageListItem } from "../type/imageItem";

export const imageApi = {
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);

    const response = await apiClient.post<ImageListItem>("/api/image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  },
  getImages: async () => {
    const response = await apiClient.get<{ data: ImageListItem[] }>("/api/image/list");
    return response.data.data;
  },
};
