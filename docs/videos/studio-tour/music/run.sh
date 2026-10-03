#!/bin/zsh
# Makes the Studio tour's music bed with ACE-Step 1.5 (see ../../overview-1.1/music/gen.py for why it is set up lean).
HERE="${0:A:h}"; cd ~/dev/tools/ACE-Step-1.5
export ACESTEP_INIT_LLM=false BPM=104 KEY="D major"
export CAPTION="Upbeat, bright and playful lo-fi electronic instrumental for a fun tech product demo. Punchy but soft hip hop drums with a bouncy groove, warm round sub bass, plucky marimba and synth plucks, sparkly bell melody, light claps, warm Rhodes chords. Positive, curious, optimistic and energetic yet relaxed, steady throughout, no big drops, no vocals."
uv run python "$HERE/gen.py" "$HERE/full" ${1:-240} ${2:-104}
