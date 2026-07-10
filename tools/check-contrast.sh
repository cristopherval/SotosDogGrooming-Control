#!/usr/bin/env bash
# WCAG contrast checker for the theme palettes.
#
# Verifies the four pairs that carry meaning in every theme:
#   ink/bg · ink/surface · muted/surface · accent-ink/accent
# AA body text requires >= 4.5:1. Run:  bash tools/check-contrast.sh
#
# Columns: name bg(3) surface(3) ink(3) muted(3) accent(3) accent-ink(3)

read -r -d '' PALETTES <<'EOF'
minimal    250 250 250  255 255 255   23  23  23  115 115 115   23  23  23  255 255 255
arena      250 246 237  255 253 248   60  47  33  128 110  90  146  91  30  255 255 255
oceano     240 247 252  255 255 255   12  42  66   82 111 136    2 108 172  255 255 255
esmeralda  240 250 245  255 255 255   16  51  38   76 116  98    4 120  87  255 255 255
coral      253 244 244  255 255 255   65  26  32  134  90  96  190  41  71  255 255 255
glass      226 232 240  255 255 255   15  23  42   71  85 105   37  99 235  255 255 255
clay       237 233 254  245 243 255   49  46 129  109 105 168   79  70 229  255 255 255
brutal     245 245 235  255 255 255   17  17  17   82  82  82  250 204  21   17  17  17
dark        10  10  10   24  24  27  244 244 245  161 161 170  244 244 245   24  24  27
medianoche   8  14  28   17  25  44  226 234 248  143 158 184   96 165 250    8  14  28
bosque       8  20  15   15  32  24  222 238 229  134 165 148   52 211 153    8  20  15
vino        24  10  15   38  17  24  245 227 231  176 138 148  244 114 148   24  10  15
carbon       0   0   0   12  12  12  240 240 240  150 150 150  255 255 255    0   0   0
EOF

echo "$PALETTES" | awk '
function lin(c,   cs) { cs = c / 255; return (cs <= 0.03928) ? cs / 12.92 : ((cs + 0.055) / 1.055) ^ 2.4 }
function lum(r, g, b) { return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) }
function ratio(r1,g1,b1, r2,g2,b2,   L1, L2, hi, lo) {
  L1 = lum(r1,g1,b1); L2 = lum(r2,g2,b2)
  hi = (L1 > L2) ? L1 : L2; lo = (L1 > L2) ? L2 : L1
  return (hi + 0.05) / (lo + 0.05)
}
function check(label, r1,g1,b1, r2,g2,b2,   v, tag) {
  v = ratio(r1,g1,b1, r2,g2,b2)
  if (v >= 4.5) { tag = "PASS" } else { tag = "FAIL"; fails++ }
  printf "  %-18s %5.2f:1  %s\n", label, v, tag
  return v
}
BEGIN { fails = 0 }
NF >= 19 {
  name = $1
  bgR=$2;  bgG=$3;  bgB=$4
  suR=$5;  suG=$6;  suB=$7
  inR=$8;  inG=$9;  inB=$10
  muR=$11; muG=$12; muB=$13
  acR=$14; acG=$15; acB=$16
  aiR=$17; aiG=$18; aiB=$19

  printf "\n%s\n", toupper(name)
  check("ink / bg",          inR,inG,inB, bgR,bgG,bgB)
  check("ink / surface",     inR,inG,inB, suR,suG,suB)
  check("muted / surface",   muR,muG,muB, suR,suG,suB)
  check("accent-ink/accent", aiR,aiG,aiB, acR,acG,acB)
}
END {
  printf "\n----------------------------------------\n"
  if (fails == 0) printf "TODO PASA AA (>= 4.5:1)\n"
  else printf "%d PAR(ES) POR DEBAJO DE AA (4.5:1)\n", fails
}
'
