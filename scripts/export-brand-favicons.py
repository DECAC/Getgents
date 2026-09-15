"""Exporte les tailles favicon / icônes Next.js depuis la source HQ."""
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[1]
brand = root / "public" / "brand"
app = root / "app"
pub = root / "public"

src = Image.open(brand / "getgents-favicon-source.png").convert("RGBA")

icon512 = src.resize((512, 512), Image.Resampling.LANCZOS)
icon512.save(app / "icon.png", optimize=True)

icon180 = src.resize((180, 180), Image.Resampling.LANCZOS)
icon180.save(app / "apple-icon.png", optimize=True)

sizes = [(16, 16), (32, 32), (48, 48)]
ico_images = [src.resize(s, Image.Resampling.LANCZOS) for s in sizes]
ico_images[0].save(
    pub / "favicon.ico",
    format="ICO",
    sizes=sizes,
    append_images=ico_images[1:],
)

src.resize((32, 32), Image.Resampling.LANCZOS).save(
    brand / "favicon-32.png", optimize=True
)
src.resize((16, 16), Image.Resampling.LANCZOS).save(
    brand / "favicon-16.png", optimize=True
)

print("OK")
for p in [
    app / "icon.png",
    app / "apple-icon.png",
    pub / "favicon.ico",
    brand / "getgents-icone.png",
    brand / "getgents-wordmark.png",
]:
    if p.suffix.lower() == ".ico":
        print(f"{p.relative_to(root)}  {p.stat().st_size} B")
    else:
        im = Image.open(p)
        print(f"{p.relative_to(root)}  {im.size}  {p.stat().st_size} B")
