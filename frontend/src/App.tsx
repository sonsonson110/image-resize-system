import { useEffect, useState } from "react";
import { imageApi } from "./api/imageApi";
import { systemApi } from "./api/systemApi";
import type { ImageListItem } from "./type/imageItem";

const placeholder = "https://placehold.co/128x128";

function App() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [images, setImages] = useState<ImageListItem[]>([]);

  const fetchImages = async () => {
    const repponse = await imageApi.getImages();
    setImages(repponse);
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedImage(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleUpload = async () => {
    if (!selectedImage) return;
    try {
      const result = await imageApi.uploadImage(selectedImage);
      setSelectedImage(null);
      setPreviewUrl(null);
      setImages((prev) => [result, ...prev]);
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  const handleSystemReset = async () => {
    // Confirm the dangerous action
    const confirmReset = window.confirm(
      "DANGER: This will delete ALL data from the system. Are you sure you want to proceed?"
    );
    
    if (!confirmReset) return;
    
    try {
      await systemApi.reset();
      window.location.reload();
    } catch (error) {
      console.error("Error resetting system:", error);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Upload Section */}
      <div className="bg-gray-50 p-6 rounded-md">
        <h2 className="text-lg font-medium text-gray-700 mb-4">Upload Image</h2>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between md:space-x-6">
          <div className="space-y-4 flex-grow">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-gray-200 file:text-gray-700 hover:file:bg-gray-300"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedImage}
              className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              Upload
            </button>
          </div>
          {previewUrl && (
            <div className="mt-4 md:mt-0">
              <img
                src={previewUrl}
                alt="preview"
                className="w-64 h-64 object-cover rounded-md"
              />
            </div>
          )}
        </div>
      </div>

      {/* Image List Section */}
      <div>
        <h2 className="text-lg font-medium text-gray-700 mb-4">
          Uploaded Images
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {images.length === 0 && (
            <p className="col-span-full text-center text-gray-500">
              No images uploaded yet.
            </p>
          )}
          {images.map((img) => (
            <div key={img.id} className="group">
              <img
                src={img.thumbnail || placeholder}
                alt={img.originalFilename}
                className="w-full aspect-square object-cover rounded-md mb-2"
              />
              <p className="text-sm truncate text-gray-700">
                {img.originalFilename}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(img.uploadedAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Dangerous Reset Button */}
      <div className="border-t border-gray-300 pt-6">
        <button
          onClick={handleSystemReset}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          RESET SYSTEM
        </button>
        <p className="text-xs text-red-500 mt-2">
          Warning: This will delete all images and data from the backend.
        </p>
      </div>
    </div>
  );
}

export default App;