#!/usr/bin/env bash
# Records the captioned demo with Playwright (local stack, synthetic data), then converts it to MP4.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf demo/out
npx playwright test --config playwright.demo.config.ts
src="$(cat demo/out/video-path.txt)"
ffmpeg -y -loglevel error -i "$src" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart demo/out/catchup-ai-demo.mp4
rm -f "$src" demo/out/video-path.txt
echo "Wrote demo/out/catchup-ai-demo.mp4 and demo/out/catchup-ai-demo.srt"
