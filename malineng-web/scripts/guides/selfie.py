# Prints a data URL of a plain placeholder portrait (no real person) for the sample resident.
import base64, io
from PIL import Image, ImageDraw
im = Image.new("RGB", (300, 400), (205, 214, 228))
d = ImageDraw.Draw(im)
d.ellipse((100, 90, 200, 190), fill=(120, 134, 160))
d.ellipse((50, 210, 250, 480), fill=(120, 134, 160))
b = io.BytesIO(); im.save(b, "JPEG", quality=80)
print("data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode())
