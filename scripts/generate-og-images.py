#!/usr/bin/env python3
"""
Generate branded OG images (1200x630px) for Uruguay clinics.
Design: gradient teal bg, clinic name centered, city/country in gold, watermarks.
"""

import os
import re
import textwrap
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow not installed. Run: pip3 install Pillow --break-system-packages")
    raise

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
CLINICS_DIR = PROJECT_ROOT / "src/content/clinicas/uruguay"
OUTPUT_DIR = PROJECT_ROOT / "public/images/clinicas/uruguay"

# Design constants
WIDTH, HEIGHT = 1200, 630
COLOR_BG_LEFT = (26, 58, 74)    # #1A3A4A
COLOR_BG_RIGHT = (42, 90, 112)  # #2a5a70
COLOR_WHITE = (255, 255, 255)
COLOR_GOLD = (201, 151, 58)     # #C9973A
COLOR_WHITE_SEMI = (255, 255, 255, 153)  # opacity ~0.6 (153/255)
COLOR_WHITE_SUBTLE = (255, 255, 255, 100)  # for line and footer


def find_font(size, bold=False):
    """Find a suitable system font."""
    candidates_bold = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/liberation/LiberationSans-Bold.ttf",
    ]
    candidates_regular = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/liberation/LiberationSans-Regular.ttf",
    ]
    candidates = candidates_bold if bold else candidates_regular
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    # Fallback: try any TTF in system
    for search_dir in ["/usr/share/fonts", "/usr/local/share/fonts"]:
        for root, dirs, files in os.walk(search_dir):
            for f in files:
                if f.endswith(".ttf"):
                    try:
                        return ImageFont.truetype(os.path.join(root, f), size)
                    except Exception:
                        continue
    # Last resort: default PIL font (no size control)
    print(f"  Warning: no TTF font found, using PIL default (size ignored)")
    return ImageFont.load_default()


def make_gradient(width, height, color_left, color_right):
    """Create a horizontal gradient image."""
    img = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(img)
    for x in range(width):
        r = int(color_left[0] + (color_right[0] - color_left[0]) * x / width)
        g = int(color_left[1] + (color_right[1] - color_left[1]) * x / width)
        b = int(color_left[2] + (color_right[2] - color_left[2]) * x / width)
        draw.line([(x, 0), (x, height)], fill=(r, g, b))
    return img


def wrap_clinic_name(name, max_chars=22):
    """Wrap clinic name to max 2 lines, ~max_chars per line."""
    words = name.split()
    lines = []
    current = ""
    for word in words:
        test = (current + " " + word).strip()
        if len(test) <= max_chars:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
        if len(lines) == 2:
            # Already have 2 lines — append rest to last line (truncated)
            remaining = " ".join(words[words.index(word):])
            if lines[1]:
                pass
            break
    if current:
        lines.append(current)
    # Max 2 lines
    if len(lines) > 2:
        lines = lines[:2]
        if len(lines[1]) > max_chars - 3:
            lines[1] = lines[1][:max_chars - 3] + "..."
    return lines


def parse_frontmatter(filepath):
    """Extract frontmatter fields from a markdown file."""
    content = filepath.read_text(encoding="utf-8")
    fm_match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not fm_match:
        return None, content
    fm_text = fm_match.group(1)
    
    def get_field(text, *keys):
        for key in keys:
            m = re.search(rf'^{key}:\s*["\']?(.*?)["\']?\s*$', text, re.MULTILINE)
            if m:
                return m.group(1).strip().strip('"\'')
        return None
    
    data = {
        "name": get_field(fm_text, "name", "nombre"),
        "slug": get_field(fm_text, "slug"),
        "ciudad": get_field(fm_text, "ciudad"),
        "pais": get_field(fm_text, "pais"),
        "imagen": get_field(fm_text, "imagen"),
    }
    return data, content


def generate_og_image(clinic_name, ciudad, pais, output_path):
    """Generate the OG image for a clinic."""
    # Base gradient
    img = make_gradient(WIDTH, HEIGHT, COLOR_BG_LEFT, COLOR_BG_RIGHT)
    
    # Overlay layer for transparency effects
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw_overlay = ImageDraw.Draw(overlay)
    
    # --- Watermark top-left: "MedicinaVip" ---
    font_watermark = find_font(24)
    draw_overlay.text((40, 32), "MedicinaVip", font=font_watermark, fill=COLOR_WHITE_SEMI)
    
    # --- Clinic name: centered, bold, 52px, max 2 lines ---
    font_name = find_font(52, bold=True)
    lines = wrap_clinic_name(clinic_name, max_chars=24)
    
    # Calculate total text block height
    line_spacing = 12
    line_heights = []
    line_widths = []
    for line in lines:
        bbox = draw_overlay.textbbox((0, 0), line, font=font_name)
        lw = bbox[2] - bbox[0]
        lh = bbox[3] - bbox[1]
        line_widths.append(lw)
        line_heights.append(lh)
    
    total_text_height = sum(line_heights) + line_spacing * (len(lines) - 1)
    
    # Location text below name
    location_text = f"{ciudad}, Uruguay"
    font_location = find_font(28)
    loc_bbox = draw_overlay.textbbox((0, 0), location_text, font=font_location)
    loc_h = loc_bbox[3] - loc_bbox[1]
    loc_gap = 28
    
    # Total block height (name + gap + location)
    block_height = total_text_height + loc_gap + loc_h
    
    # Start Y: center the whole block vertically (slightly above center)
    start_y = (HEIGHT - block_height) // 2 - 20
    
    # Draw name lines
    y = start_y
    for i, line in enumerate(lines):
        x = (WIDTH - line_widths[i]) // 2
        # Slight shadow for depth
        draw_overlay.text((x + 2, y + 2), line, font=font_name, fill=(0, 0, 0, 80))
        draw_overlay.text((x, y), line, font=font_name, fill=COLOR_WHITE + (255,))
        y += line_heights[i] + line_spacing
    
    # Draw location (city, country) in gold
    loc_x = (WIDTH - (loc_bbox[2] - loc_bbox[0])) // 2
    loc_y = y + loc_gap - line_spacing  # a bit after name
    draw_overlay.text((loc_x, loc_y), location_text, font=font_location, fill=COLOR_GOLD + (255,))
    
    # --- Bottom section ---
    # Horizontal line
    line_y = HEIGHT - 70
    draw_overlay.line([(80, line_y), (WIDTH - 80, line_y)], fill=COLOR_WHITE_SUBTLE, width=1)
    
    # "medicinavip.com" footer
    font_footer = find_font(20)
    footer_text = "medicinavip.com"
    ft_bbox = draw_overlay.textbbox((0, 0), footer_text, font=font_footer)
    ft_w = ft_bbox[2] - ft_bbox[0]
    ft_x = (WIDTH - ft_w) // 2
    draw_overlay.text((ft_x, line_y + 14), footer_text, font=font_footer, fill=COLOR_WHITE_SEMI)
    
    # Composite overlay onto gradient
    img = img.convert("RGBA")
    img = Image.alpha_composite(img, overlay)
    img = img.convert("RGB")
    
    img.save(output_path, "PNG", optimize=True)
    print(f"  ✓ Saved: {output_path.name}")


def add_imagen_to_frontmatter(filepath, imagen_value):
    """Add imagen field to frontmatter if not already present."""
    content = filepath.read_text(encoding="utf-8")
    fm_match = re.match(r"^(---\n)(.*?)(\n---)", content, re.DOTALL)
    if not fm_match:
        print(f"  Warning: no frontmatter found in {filepath.name}")
        return
    
    fm_text = fm_match.group(2)
    
    # Check if already set
    if re.search(r'^imagen:', fm_text, re.MULTILINE):
        print(f"  → imagen already set in {filepath.name}")
        return
    
    # Insert after 'draft:' or 'featured:' or before closing ---
    new_fm = fm_text + f'\nimagen: "{imagen_value}"'
    new_content = f"---\n{new_fm}\n---" + content[fm_match.end():]
    filepath.write_text(new_content, encoding="utf-8")
    print(f"  ✓ Updated frontmatter: {filepath.name}")


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    md_files = sorted(CLINICS_DIR.glob("*.md"))
    print(f"Found {len(md_files)} Uruguay clinic files\n")
    
    for md_file in md_files:
        data, content = parse_frontmatter(md_file)
        if not data:
            print(f"Skipping {md_file.name} — no frontmatter")
            continue
        
        name = data["name"]
        slug = data["slug"]
        ciudad = data["ciudad"]
        pais = data.get("pais", "uruguay")
        
        if not name or not slug:
            print(f"Skipping {md_file.name} — missing name or slug")
            continue
        
        print(f"Processing: {name}")
        
        output_path = OUTPUT_DIR / f"{slug}.png"
        generate_og_image(name, ciudad or "Uruguay", pais or "Uruguay", output_path)
        
        imagen_value = f"/images/clinicas/uruguay/{slug}.png"
        add_imagen_to_frontmatter(md_file, imagen_value)
        print()
    
    print("Done! All Uruguay OG images generated.")


if __name__ == "__main__":
    main()
