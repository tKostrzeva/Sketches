#!/usr/bin/env python3
"""
Converts a text file to a RAW image file openable in Photoshop.

Usage:
    python3 text_to_raw.py input.txt [output.raw] [--width 800] [--font-size 14]

In Photoshop: File > Open As > Raw
    Width/Height: as printed by this script
    Channels: 1 (Grayscale) or 3 (RGB)
    Depth: 8 bits
"""

import sys
import argparse
from PIL import Image, ImageDraw, ImageFont

def text_to_raw(input_path, output_path, img_width=800, font_size=14, color=False):
    with open(input_path, "r", encoding="utf-8") as f:
        text = f.read()

    # Try to load a monospace font, fall back to default
    font = None
    for font_path in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeMono.ttf",
    ]:
        try:
            font = ImageFont.truetype(font_path, font_size)
            break
        except (IOError, OSError):
            continue
    if font is None:
        font = ImageFont.load_default()

    # Measure character cell size
    dummy = Image.new("RGB", (1, 1))
    draw = ImageDraw.Draw(dummy)
    bbox = draw.textbbox((0, 0), "A", font=font)
    char_w = bbox[2] - bbox[0]
    char_h = bbox[3] - bbox[1]
    line_h = char_h + 4  # small line spacing

    lines = text.splitlines()
    img_height = max(1, len(lines) * line_h + 10)

    mode = "RGB" if color else "L"
    bg = (255, 255, 255) if color else 255
    fg = (30, 30, 30) if color else 0

    img = Image.new(mode, (img_width, img_height), bg)
    draw = ImageDraw.Draw(img)

    for i, line in enumerate(lines):
        y = 5 + i * line_h
        draw.text((5, y), line, font=font, fill=fg)

    # Save as raw pixel bytes
    raw_bytes = img.tobytes()
    with open(output_path, "wb") as f:
        f.write(raw_bytes)

    channels = 3 if color else 1
    print(f"Saved: {output_path}")
    print(f"  Width:    {img_width} px")
    print(f"  Height:   {img_height} px")
    print(f"  Channels: {channels} ({'RGB' if color else 'Grayscale'})")
    print(f"  Depth:    8 bit")
    print()
    print("Open in Photoshop: File > Open As > Raw")
    print(f"  Enter width={img_width}, height={img_height}, channels={channels}, depth=8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert text file to Photoshop RAW")
    parser.add_argument("input", help="Input text file")
    parser.add_argument("output", nargs="?", help="Output .raw file (default: input.raw)")
    parser.add_argument("--width", type=int, default=800, help="Image width in pixels (default: 800)")
    parser.add_argument("--font-size", type=int, default=14, help="Font size (default: 14)")
    parser.add_argument("--color", action="store_true", help="Output RGB instead of grayscale")
    args = parser.parse_args()

    output = args.output or (args.input.rsplit(".", 1)[0] + ".raw")
    text_to_raw(args.input, output, args.width, args.font_size, args.color)
