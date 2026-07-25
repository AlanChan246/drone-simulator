#!/usr/bin/env bash
# Build the 14-second homepage loop from the approved v2 storyboard.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STORYBOARD="$ROOT/assets/images/storyboard-v2"
OUT="$ROOT/assets/video"
TMP="$OUT/.tmp_hero_v2"

FPS=30
WIDTH=1920
HEIGHT=1080
FADE=0.25
LOOP_BLEND=0.50

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing dependency: $1" >&2
    exit 1
  }
}

need ffmpeg
need ffprobe

shots=(
  "01-programmed-base.png"
  "02-city-takeoff.png"
  "03-inspection-scan.png"
  "04-smoke-water-transition.png"
  "05-wildfire-response.png"
  "06-rescue-approach.png"
  "07-landing-loop.png"
)

for shot in "${shots[@]}"; do
  [[ -f "$STORYBOARD/$shot" ]] || {
    echo "Missing storyboard frame: $STORYBOARD/$shot" >&2
    exit 1
  }
done

mkdir -p "$OUT" "$TMP"
find "$TMP" -type f -delete

# Durations include the 0.25s overlap. Their sum minus six overlaps is 14s.
durations=(2.15 2.35 2.25 1.85 2.95 2.05 1.90)

render_shot() {
  local source="$1"
  local target="$2"
  local duration="$3"
  local zoom="$4"
  local x="$5"
  local y="$6"
  local frames
  frames="$(awk -v d="$duration" -v fps="$FPS" 'BEGIN { printf "%d", d * fps + 0.5 }')"

  ffmpeg -y -hide_banner -loglevel error \
    -loop 1 -i "$source" \
    -vf "scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},setsar=1,zoompan=z='${zoom}':x='${x}':y='${y}':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},eq=contrast=1.025:saturation=0.94:brightness=-0.012,format=yuv420p" \
    -t "$duration" -an \
    -c:v libx264 -preset medium -crf 20 -g "$FPS" -keyint_min "$FPS" \
    "$target"
}

echo "Rendering seven cinematic shots…"

# 1: slow push toward the programmed base.
render_shot "$STORYBOARD/${shots[0]}" "$TMP/01.mp4" "${durations[0]}" \
  "min(1.0+0.055*on/${FPS}/2.15,1.055)" \
  "iw/2-(iw/zoom/2)+iw*0.018*on/${FPS}/2.15" \
  "ih/2-(ih/zoom/2)-ih*0.010*on/${FPS}/2.15"

# 2: lift and accelerate down the city route.
render_shot "$STORYBOARD/${shots[1]}" "$TMP/02.mp4" "${durations[1]}" \
  "min(1.025+0.070*on/${FPS}/2.35,1.095)" \
  "iw/2-(iw/zoom/2)+iw*0.030*on/${FPS}/2.35" \
  "ih/2-(ih/zoom/2)-ih*0.028*on/${FPS}/2.35"

# 3: settle into a precise inspection hover.
render_shot "$STORYBOARD/${shots[2]}" "$TMP/03.mp4" "${durations[2]}" \
  "min(1.015+0.045*on/${FPS}/2.25,1.060)" \
  "iw/2-(iw/zoom/2)+iw*0.015*on/${FPS}/2.25" \
  "ih/2-(ih/zoom/2)"

# 4: lateral smoke match-cut from city to water and forest.
render_shot "$STORYBOARD/${shots[3]}" "$TMP/04.mp4" "${durations[3]}" \
  "1.045" \
  "(iw-iw/zoom)*(0.18+0.62*on/${FPS}/1.85)" \
  "ih/2-(ih/zoom/2)"

# 5: brake above the fire while the water action holds on screen.
render_shot "$STORYBOARD/${shots[4]}" "$TMP/05.mp4" "${durations[4]}" \
  "min(1.010+0.060*on/${FPS}/2.95,1.070)" \
  "iw/2-(iw/zoom/2)+iw*0.012*on/${FPS}/2.95" \
  "ih/2-(ih/zoom/2)-ih*0.018*on/${FPS}/2.95"

# 6: rise into the rescue-pad approach.
render_shot "$STORYBOARD/${shots[5]}" "$TMP/06.mp4" "${durations[5]}" \
  "max(1.085-0.055*on/${FPS}/2.05,1.030)" \
  "iw/2-(iw/zoom/2)-iw*0.012*on/${FPS}/2.05" \
  "ih/2-(ih/zoom/2)-ih*0.015*on/${FPS}/2.05"

# 7: ease down to the landing composition.
render_shot "$STORYBOARD/${shots[6]}" "$TMP/07.mp4" "${durations[6]}" \
  "min(1.010+0.035*on/${FPS}/1.90,1.045)" \
  "iw/2-(iw/zoom/2)+iw*0.008*on/${FPS}/1.90" \
  "ih/2-(ih/zoom/2)+ih*0.010*on/${FPS}/1.90"

echo "Assembling the 14-second timeline…"
ffmpeg -y -hide_banner -loglevel error \
  -i "$TMP/01.mp4" -i "$TMP/02.mp4" -i "$TMP/03.mp4" \
  -i "$TMP/04.mp4" -i "$TMP/05.mp4" -i "$TMP/06.mp4" -i "$TMP/07.mp4" \
  -filter_complex "\
[0:v][1:v]xfade=transition=fade:duration=${FADE}:offset=1.90[v12];\
[v12][2:v]xfade=transition=fade:duration=${FADE}:offset=4.00[v123];\
[v123][3:v]xfade=transition=fade:duration=${FADE}:offset=6.00[v1234];\
[v1234][4:v]xfade=transition=fade:duration=${FADE}:offset=7.60[v12345];\
[v12345][5:v]xfade=transition=fade:duration=${FADE}:offset=10.30[v123456];\
[v123456][6:v]xfade=transition=fade:duration=${FADE}:offset=12.10,fps=${FPS},trim=duration=14,setpts=PTS-STARTPTS[linear]" \
  -map "[linear]" -an \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  "$TMP/linear.mp4"

# Blend the final landing half-second into the opening base frame. This keeps
# environment and light continuity without a black frame or reverse playback.
echo "Polishing the end-to-start loop seam…"
ffmpeg -y -hide_banner -loglevel error \
  -i "$TMP/linear.mp4" \
  -filter_complex "\
[0:v]fps=${FPS},split=3[body_src][tail_src][open_src];\
[body_src]trim=duration=13.5,setpts=PTS-STARTPTS,fps=${FPS},settb=AVTB[body];\
[tail_src]trim=start=13.5:end=14,setpts=PTS-STARTPTS,fps=${FPS},settb=AVTB[tail];\
[open_src]trim=duration=${LOOP_BLEND},setpts=PTS-STARTPTS,fps=${FPS},settb=AVTB[open];\
[tail][open]xfade=transition=fade:duration=${LOOP_BLEND}:offset=0[seam];\
[body][seam]concat=n=2:v=1:a=0,fps=${FPS},tpad=stop_mode=clone:stop_duration=0.034,trim=duration=14,setpts=PTS-STARTPTS[outv]" \
  -map "[outv]" -an \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
  -g "$FPS" -keyint_min "$FPS" -movflags +faststart \
  "$OUT/hero-loop-v2.mp4"

echo "Encoding VP9 WebM…"
ffmpeg -y -hide_banner -loglevel error \
  -i "$OUT/hero-loop-v2.mp4" \
  -an -c:v libvpx-vp9 -b:v 0 -crf 35 -row-mt 1 -tile-columns 2 \
  -g "$FPS" -pix_fmt yuv420p \
  "$OUT/hero-loop-v2.webm"

echo "Writing poster frame…"
ffmpeg -y -hide_banner -loglevel error \
  -ss 0 -i "$OUT/hero-loop-v2.mp4" -frames:v 1 \
  "$OUT/hero-loop-v2-poster.jpg"

find "$TMP" -type f -delete
rmdir "$TMP"

echo "Built:"
ls -lh "$OUT/hero-loop-v2.mp4" "$OUT/hero-loop-v2.webm" "$OUT/hero-loop-v2-poster.jpg"
ffprobe -v error \
  -show_entries stream=width,height,r_frame_rate:format=duration,size \
  -of default=noprint_wrappers=1 \
  "$OUT/hero-loop-v2.mp4"
