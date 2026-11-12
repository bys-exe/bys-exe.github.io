#!/usr/bin/env python3
"""Resize and re-encode gallery source images.

The Astro build creates responsive WebP variants for the gallery, but the
source files in ``src/assets/gallery`` are large PNGs. Optimizing those sources
keeps the repository small, makes image processing during the build faster,
and reduces the size of the full-size lightbox images.

Usage:
    python scripts/optimize_gallery.py --dry-run
    python scripts/optimize_gallery.py
    python scripts/optimize_gallery.py --format webp --quality 82

By default files are optimized in place and keep their current format. GIFs
and animated images are skipped so animations stay intact.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
DEFAULT_GALLERY_DIR = Path("src/assets/gallery")
DEFAULT_MAX_DIMENSION = 1600
DEFAULT_QUALITY = 85

FORMAT_BY_EXTENSION = {
    ".png": "PNG",
    ".jpg": "JPEG",
    ".jpeg": "JPEG",
    ".webp": "WEBP",
}


@dataclass
class ImageResult:
    """Outcome of processing a single image."""

    path: Path
    action: str
    original_size: int
    optimized_size: int | None = None
    original_dimensions: tuple[int, int] | None = None
    optimized_dimensions: tuple[int, int] | None = None
    error: str | None = None

    @property
    def saved_bytes(self) -> int:
        if self.optimized_size is None:
            return 0
        return max(0, self.original_size - self.optimized_size)

    @property
    def savings_percent(self) -> float:
        if not self.original_size or self.optimized_size is None:
            return 0.0
        return max(0.0, (1 - self.optimized_size / self.original_size) * 100)


def human_size(num_bytes: int) -> str:
    """Format a byte count in a compact, human-readable way."""
    value = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            if unit == "B":
                return f"{int(value)} B"
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} GB"


def display_path(path: Path) -> str:
    """Show paths relative to the repository root when possible."""
    try:
        return str(path.relative_to(Path.cwd()))
    except ValueError:
        return str(path)


def find_images(root: Path) -> list[Path]:
    """Find supported image files under ``root``, recursively."""
    if not root.exists():
        raise FileNotFoundError(f"Image directory not found: {root}")
    if not root.is_dir():
        raise NotADirectoryError(f"Not a directory: {root}")

    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def resolve_format(image: Image.Image, path: Path, requested: str) -> str:
    """Choose the output format for an image."""
    if requested == "webp":
        return "WEBP"

    detected = (image.format or "").upper()
    if detected in {"PNG", "JPEG", "WEBP"}:
        return detected

    extension_format = FORMAT_BY_EXTENSION.get(path.suffix.lower())
    if extension_format is None:
        raise ValueError(f"Unsupported image format: {path.suffix}")
    return extension_format


def target_suffix(path: Path, image_format: str) -> str:
    """Return the output extension for a target format."""
    if image_format == "WEBP":
        return ".webp"
    if image_format == "JPEG":
        # Preserve .jpeg if that is what the source used.
        return path.suffix.lower() if path.suffix.lower() in {".jpg", ".jpeg"} else ".jpg"
    return ".png"


def prepare_for_format(image: Image.Image, image_format: str) -> Image.Image:
    """Normalize color mode and orientation before saving."""
    image = ImageOps.exif_transpose(image)
    has_alpha = image.mode in {"RGBA", "LA"} or (
        image.mode == "P" and "transparency" in image.info
    )

    if image_format == "JPEG":
        if has_alpha:
            rgba = image.convert("RGBA")
            background = Image.new("RGB", rgba.size, (255, 255, 255))
            background.paste(rgba, mask=rgba.getchannel("A"))
            return background
        if image.mode != "RGB":
            return image.convert("RGB")
        return image

    if image_format == "WEBP" and image.mode == "P":
        return image.convert("RGBA" if has_alpha else "RGB")

    if has_alpha and image.mode != "RGBA":
        return image.convert("RGBA")

    return image


def resize_if_needed(
    image: Image.Image, max_dimension: int
) -> tuple[Image.Image, bool]:
    """Resize so the longest side fits within ``max_dimension``."""
    width, height = image.size
    longest_side = max(width, height)
    if longest_side <= max_dimension:
        return image, False

    scale = max_dimension / longest_side
    new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return image.resize(new_size, Image.Resampling.LANCZOS), True


def save_options(image_format: str, quality: int) -> dict[str, object]:
    """Encoder settings for the chosen output format."""
    if image_format == "WEBP":
        return {"quality": quality, "method": 6}
    if image_format == "JPEG":
        return {"quality": quality, "optimize": True, "progressive": True}
    return {"optimize": True}


def optimize_image(path: Path, args: argparse.Namespace) -> ImageResult:
    """Optimize one image, writing the result only when it is smaller."""
    original_size = path.stat().st_size
    temp_path: Path | None = None

    try:
        with Image.open(path) as image:
            original_dimensions = image.size
            if getattr(image, "is_animated", False):
                return ImageResult(
                    path,
                    "skipped (animated)",
                    original_size,
                    original_dimensions=original_dimensions,
                )

            image_format = resolve_format(image, path, args.format)
            prepared = prepare_for_format(image, image_format)
            resized, _ = resize_if_needed(prepared, args.max_dimension)
            optimized_dimensions = resized.size

            suffix = target_suffix(path, image_format)
            with tempfile.NamedTemporaryFile(
                dir=path.parent,
                prefix=f".{path.stem}-",
                suffix=suffix,
                delete=False,
            ) as temp_file:
                temp_path = Path(temp_file.name)

            resized.save(
                temp_path,
                format=image_format,
                **save_options(image_format, args.quality),
            )
            optimized_size = temp_path.stat().st_size

        # The source file is closed now, so Windows can replace it safely.
        if optimized_size >= original_size:
            return ImageResult(
                path,
                "skipped (no savings)",
                original_size,
                optimized_size,
                original_dimensions,
                optimized_dimensions,
            )

        converting = image_format == "WEBP" and path.suffix.lower() != ".webp"
        final_path = path.with_suffix(suffix)
        if final_path != path and final_path.exists():
            return ImageResult(
                path,
                f"skipped (target exists: {final_path.name})",
                original_size,
                optimized_size,
                original_dimensions,
                optimized_dimensions,
            )

        if args.dry_run:
            action = "would convert" if converting else "would optimize"
            return ImageResult(
                path,
                action,
                original_size,
                optimized_size,
                original_dimensions,
                optimized_dimensions,
            )

        if final_path != path:
            os.replace(temp_path, final_path)
            temp_path = None
            path.unlink()
            action = "converted"
        else:
            os.replace(temp_path, path)
            temp_path = None
            action = "optimized"

        return ImageResult(
            path,
            action,
            original_size,
            optimized_size,
            original_dimensions,
            optimized_dimensions,
        )
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        return ImageResult(
            path,
            "error",
            original_size,
            error=str(exc),
        )
    finally:
        if temp_path is not None and temp_path.exists():
            temp_path.unlink()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Resize and re-encode gallery images to keep the repository "
            "and Astro builds small."
        ),
    )
    parser.add_argument(
        "path",
        nargs="?",
        type=Path,
        default=DEFAULT_GALLERY_DIR,
        help=f"Directory to scan (default: {DEFAULT_GALLERY_DIR})",
    )
    parser.add_argument(
        "--dry-run",
        "-n",
        action="store_true",
        help="Report what would change without modifying any files.",
    )
    parser.add_argument(
        "--max-dimension",
        type=int,
        default=DEFAULT_MAX_DIMENSION,
        help=f"Maximum width/height in pixels (default: {DEFAULT_MAX_DIMENSION}).",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=DEFAULT_QUALITY,
        choices=range(1, 101),
        metavar="1-100",
        help=f"Encoder quality for WebP/JPEG (default: {DEFAULT_QUALITY}).",
    )
    parser.add_argument(
        "--format",
        choices=("keep", "webp"),
        default="keep",
        help=(
            "Keep the original format, or convert to WebP. Converting changes "
            "file extensions, so update any explicit cover: fields in gallery markdown."
        ),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.max_dimension < 1:
        parser.error("--max-dimension must be at least 1")

    try:
        images = find_images(args.path)
    except (FileNotFoundError, NotADirectoryError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if not images:
        print(f"No supported images found in {args.path}.")
        return 0

    print(
        f"Scanning {len(images)} image(s) in {display_path(args.path)} "
        f"(max {args.max_dimension}px, quality {args.quality}, format {args.format})"
    )
    if args.dry_run:
        print("Dry run: no files will be modified.\n")

    results: list[ImageResult] = []
    for path in images:
        result = optimize_image(path, args)
        results.append(result)

        if result.action == "error":
            print(f"  ERROR  {display_path(path)}: {result.error}")
            continue

        dimensions = ""
        if result.original_dimensions and result.optimized_dimensions:
            old_width, old_height = result.original_dimensions
            new_width, new_height = result.optimized_dimensions
            dimensions = f"  {old_width}x{old_height} -> {new_width}x{new_height}"

        if result.optimized_size is None:
            print(f"  SKIP   {display_path(path)}{dimensions}  ({result.action})")
            continue

        print(
            f"  {result.action.upper():<14} {display_path(path)}{dimensions}  "
            f"{human_size(result.original_size)} -> "
            f"{human_size(result.optimized_size)} "
            f"({result.savings_percent:.1f}% smaller)"
        )

    optimized = [
        result
        for result in results
        if result.action
        in {"optimized", "converted", "would optimize", "would convert"}
    ]
    skipped = [result for result in results if result.action.startswith("skipped")]
    errors = [result for result in results if result.action == "error"]
    saved_bytes = sum(result.saved_bytes for result in optimized)

    print()
    print(
        f"{len(results)} scanned, {len(optimized)} "
        f"{'would be optimized' if args.dry_run else 'optimized'}, "
        f"{len(skipped)} skipped, {len(errors)} error(s)."
    )
    if saved_bytes:
        label = "Potential savings" if args.dry_run else "Saved"
        print(f"{label}: {human_size(saved_bytes)}.")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
