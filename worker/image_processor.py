from PIL import Image
import os

def generate_thumbnail(input_path: str, output_path: str, size=(128, 128)):
    """Resize the image to a thumbnail and save it"""
    with Image.open(input_path) as img:
        img.thumbnail(size)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        img.save(output_path, optimize=True)
        return os.path.getsize(output_path)
