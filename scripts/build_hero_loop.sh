#!/usr/bin/env bash
# Build muted 10s cinematic hero loop from storyboard stills (Ken Burns + xfade).
# Skips storyboard-04 (UI chrome) per brief.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SB="$ROOT/assets/images/storyboard"
OUT_DIR="$ROOT/assets/video"
TMP="$OUT_DIR/.tmp_hero"

FPS=30
W=1280
H=720
SEG=2.75
FADE=0.333
LOOP_FADE=0.5

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1" >&2; exit 1; }
}
need ffmpeg

for f in \
  storyboard-01-takeoff.png \
  storyboard-02-pursuit.png \
  storyboard-03-wildfire.png \
  storyboard-05-landing-loop.png
do
  if [[ ! -f "$SB/$f" ]]; then
    echo "Missing storyboard: $SB/$f" >&2
    exit 1
  fi
done

mkdir -p "$OUT_DIR" "$TMP"
rm -rf "$TMP"/*
FRAMES="$(python3 -c "print(int(round($SEG * $FPS)))")"

# Prep: cover-crop to 1280x720 still, then Ken Burns via zoompan.
# Teal flight-deck lift via colorbalance + slight desat.
make_seg() {
  local src="$1"
  local dst="$2"
  local zexpr="$3"
  local xexpr="$4"
  local yexpr="$5"

  ffmpeg -y -hide_banner -loglevel error \
    -loop 1 -i "$src" \
    -vf "scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,zoompan=z='${zexpr}':x='${xexpr}':y='${yexpr}':d=${FRAMES}:s=${W}x${H}:fps=${FPS},colorbalance=rs=-0.08:gs=0.02:bs=0.10:rm=-0.05:bm=0.07,eq=saturation=0.90:contrast=1.04:brightness=-0.02" \
    -t "$SEG" -an \
    -c:v libx264 -pix_fmt yuv420p -preset medium -crf 19 \
    "$dst"
}

echo "Rendering Ken Burns segments (${SEG}s each)…"

# 01 takeoff: slow push-in toward drone
make_seg "$SB/storyboard-01-takeoff.png" "$TMP/01.mp4" \
  "min(1.0+0.10*on/${FRAMES},1.10)" \
  "iw/2-(iw/zoom/2)" \
  "ih/2-(ih/zoom/2)-ih*0.02*(on/${FRAMES})"

# 02 pursuit: slight forward-right pan while gently zooming
make_seg "$SB/storyboard-02-pursuit.png" "$TMP/02.mp4" \
  "min(1.05+0.06*on/${FRAMES},1.11)" \
  "(iw-iw/zoom)*(0.15+0.55*on/${FRAMES})" \
  "ih/2-(ih/zoom/2)"

# 03 wildfire / water-drop pass: push toward fire glow
make_seg "$SB/storyboard-03-wildfire.png" "$TMP/03.mp4" \
  "min(1.02+0.12*on/${FRAMES},1.14)" \
  "iw/2-(iw/zoom/2)+iw*0.04*(on/${FRAMES})" \
  "ih/2-(ih/zoom/2)-ih*0.03*(on/${FRAMES})"

# 05 landing → open aerial for loop match: ease zoom-out
make_seg "$SB/storyboard-05-landing-loop.png" "$TMP/05.mp4" \
  "max(1.12-0.10*on/${FRAMES},1.02)" \
  "iw/2-(iw/zoom/2)" \
  "ih/2-(ih/zoom/2)"

OFFSET1="$(python3 -c "print(round($SEG - $FADE, 3))")"
OFFSET2="$(python3 -c "print(round($OFFSET1 + $SEG - $FADE, 3))")"
OFFSET3="$(python3 -c "print(round($OFFSET2 + $SEG - $FADE, 3))")"

echo "Crossfading timeline (offsets ${OFFSET1}, ${OFFSET2}, ${OFFSET3})…"

ffmpeg -y -hide_banner -loglevel error \
  -i "$TMP/01.mp4" -i "$TMP/02.mp4" -i "$TMP/03.mp4" -i "$TMP/05.mp4" \
  -filter_complex "\
[0:v][1:v]xfade=transition=fade:duration=${FADE}:offset=${OFFSET1}[v01];\
[v01][2:v]xfade=transition=fade:duration=${FADE}:offset=${OFFSET2}[v012];\
[v012][3:v]xfade=transition=fade:duration=${FADE}:offset=${OFFSET3}[vline]" \
  -map "[vline]" -an \
  -c:v libx264 -pix_fmt yuv420p -preset medium -crf 19 \
  "$TMP/linear.mp4"

# Seamless loop polish: blend last LOOP_FADE seconds into opening
HEAD_DUR="$(python3 -c "print(round(10.0 - $LOOP_FADE, 3))")"
echo "Applying ${LOOP_FADE}s end→start loop blend…"

ffmpeg -y -hide_banner -loglevel error \
  -i "$TMP/linear.mp4" \
  -filter_complex "\
[0:v]fps=${FPS},setpts=PTS-STARTPTS,split=3[v0][v1][v2];\
[v0]trim=duration=${HEAD_DUR},setpts=PTS-STARTPTS[head];\
[v1]trim=start=${HEAD_DUR},setpts=PTS-STARTPTS,fps=${FPS}[tail];\
[v2]trim=duration=${LOOP_FADE},setpts=PTS-STARTPTS,fps=${FPS}[open];\
[tail][open]xfade=transition=fade:duration=${LOOP_FADE}:offset=0,fps=${FPS}[blend];\
[head][blend]concat=n=2:v=1:a=0,fps=${FPS},trim=duration=10,setpts=PTS-STARTPTS[outv]" \
  -map "[outv]" -an \
  -c:v libx264 -pix_fmt yuv420p -preset medium -crf 19 \
  -movflags +faststart \
  "$OUT_DIR/hero-loop.mp4"

echo "Encoding WebM…"
ffmpeg -y -hide_banner -loglevel error \
  -i "$OUT_DIR/hero-loop.mp4" \
  -an -c:v libvpx-vp9 -b:v 0 -crf 32 -row-mt 1 -pix_fmt yuv420p \
  "$OUT_DIR/hero-loop.webm"

rm -rf "$TMP"

echo "Done:"
ls -lh "$OUT_DIR/hero-loop.mp4" "$OUT_DIR/hero-loop.webm"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUT_DIR/hero-loop.mp4"
