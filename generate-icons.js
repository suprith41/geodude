const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const sizes = [
  { size: 16,  fontSize: 10  },
  { size: 48,  fontSize: 30  },
  { size: 128, fontSize: 80  },
];
const outDir = path.join(__dirname, "icons");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

sizes.forEach(({ size, fontSize }) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Purple background
  ctx.fillStyle = "#6c47ff";
  ctx.fillRect(0, 0, size, size);

  // Centered emoji
  ctx.font = `${fontSize}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🪨", size / 2, size / 2);

  const buffer = canvas.toBuffer("image/png");
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated: ${outPath}`);
});
