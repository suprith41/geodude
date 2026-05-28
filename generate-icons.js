const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const sizes = [16, 48, 128];
const outDir = path.join(__dirname, "icons");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

sizes.forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Purple background
  ctx.fillStyle = "#6c47ff";
  ctx.fillRect(0, 0, size, size);

  // Centered emoji
  const fontSize = Math.floor(size * 0.6);
  ctx.font = `${fontSize}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🪨", size / 2, size / 2);

  const buffer = canvas.toBuffer("image/png");
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
});
