#!/usr/bin/env python3
"""gen.py <out_dir> <duration_s> <seed>: a soft chill instrumental bed for the Paper Coach
overview, made locally with ACE-Step 1.5 (MIT licence) from ~/dev/tools/ACE-Step-1.5:
  cd ~/dev/tools/ACE-Step-1.5 && uv run python <this file> <out_dir> 240 2026

Lean on a 16 GB Mac: the turbo DiT in bfloat16 on MPS (ACE-Step's default there is float32 plus a second
MLX copy, about 19 GB), and no 5 Hz language model (the caption, BPM and key steer it instead).
"""
import gc, os, sys, time, shutil
ROOT = os.path.expanduser("~/dev/tools/ACE-Step-1.5")
sys.path.insert(0, ROOT)
os.chdir(ROOT)
import torch
from acestep.handler import AceStepHandler
from acestep.llm_inference import LLMHandler
from acestep.inference import GenerationParams, GenerationConfig, generate_music
from acestep.core.generation.handler import init_service_loader as loader

_load = loader.InitServiceLoaderMixin._load_main_model_from_checkpoint
def _load_bf16(self, *args, **kwargs):
    self.dtype = torch.bfloat16
    return _load(self, *args, **kwargs)
loader.InitServiceLoaderMixin._load_main_model_from_checkpoint = _load_bf16

# One track per run, so once the DiT has made the latents it can go before the VAE decodes them: on 16 GB the two
# together pushed the Mac deep into swap.
from acestep.core.generation.handler import generate_music_decode as decode
_decode = decode.GenerateMusicDecodeMixin._decode_generate_music_pred_latents
def _decode_alone(self, pred_latents, *args, **kwargs):
    latents = pred_latents.detach().to("cpu")
    del pred_latents
    self.model, self.mlx_decoder, self.text_encoder = None, None, None
    gc.collect()
    torch.mps.empty_cache()
    print("FREED the DiT before decoding", flush=True)
    return _decode(self, latents.to(self.device), *args, **kwargs)
decode.GenerateMusicDecodeMixin._decode_generate_music_pred_latents = _decode_alone

CAPTION = os.environ.get("CAPTION") or (
    "Soft, warm and cozy lo-fi chillhop instrumental for a calm drawing tutorial. Mellow Rhodes electric piano "
    "playing gentle jazzy seventh chords, a soft round bass, light brushed drums with a relaxed laid-back groove, "
    "a little vinyl crackle, airy pads, and a sweet simple melody on a soft felt piano and a mellow glockenspiel. "
    "Peaceful, happy, hopeful and inviting; steady and even throughout, no drops, no vocals."
)

out_dir, duration, seeds = sys.argv[1], float(sys.argv[2]), [int(s) for s in sys.argv[3:4]] or [-1]  # one seed: the DiT is freed
os.makedirs(out_dir, exist_ok=True)

dit = AceStepHandler()
t0 = time.time()
msg, ok = dit.initialize_service(project_root=ROOT, config_path="acestep-v15-turbo", device="mps",
                                 offload_to_cpu=False, use_mlx_dit=False)
assert ok, msg
print(f"LOADED in {time.time() - t0:.0f}s dtype={dit.dtype}", flush=True)
llm = LLMHandler()  # never initialised: generate_music then skips the LM

for seed in seeds:
    params = GenerationParams(task_type="text2music", thinking=False, use_cot_metas=False, use_cot_caption=False,
                              use_cot_language=False, caption=CAPTION, lyrics="[Instrumental]", instrumental=True,
                              bpm=int(os.environ.get("BPM", "80")), keyscale=os.environ.get("KEY", "F major"), timesignature="4", vocal_language="unknown",
                              duration=duration, inference_steps=8, guidance_scale=1.0, seed=seed)
    t0 = time.time()
    res = generate_music(dit, llm, params=params, config=GenerationConfig(batch_size=1, audio_format="wav", use_random_seed=False, seeds=[seed]),
                         save_dir=os.path.join(out_dir, "tmp"))
    assert res.success, res.status_message
    for a in res.audios:
        dst = os.path.join(out_dir, f"bed-{int(duration)}s-seed{a['params'].get('seed', seed)}.wav")
        shutil.move(a["path"], dst)
        print(f"WROTE {dst} in {time.time() - t0:.0f}s", flush=True)
