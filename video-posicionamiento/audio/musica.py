# Base musical sintetizada (ambient electrónico, 100 BPM, La menor). Uso: python3 audio/musica.py
import numpy as np, wave, os
SR, DUR, BPM = 44100, 91.0, 100
beat = 60 / BPM; N = int(SR * DUR); t = np.arange(N) / SR
rng = np.random.default_rng(3)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
CH = [[57, 60, 64, 71], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 64]]  # Am9 Fmaj7 Cmaj7 G6
CL = 8 * beat  # 2 compases por acorde
L = np.zeros(N); R = np.zeros(N)

def add(buf, start, sig):
    i = int(start * SR)
    if i >= N: return
    sig = sig[: N - i]; buf[i:i + len(sig)] += sig

# pad
k = 0
while k * CL < DUR:
    ch = CH[k % 4] if k * CL < 81.6 else CH[2]
    n = int((CL + 1.6) * SR); tt = np.arange(n) / SR
    env = np.minimum(1, tt / 1.6) * np.minimum(1, (tt[-1] - tt) / 1.6)
    for j, m in enumerate(ch):
        f = hz(m)
        for det, pan in ((-0.25, .3), (0.25, .7)):
            ff = f * (1 + det / 100)
            s = (np.sin(2 * np.pi * ff * tt) + .35 * np.sin(4 * np.pi * ff * tt + j) + .12 * np.sin(6 * np.pi * ff * tt)) * env * .05
            add(L, k * CL, s * (1 - pan)); add(R, k * CL, s * pan)
    sub = np.sin(2 * np.pi * hz(ch[0] - 24) * tt) * env * .16
    add(L, k * CL, sub); add(R, k * CL, sub)
    k += 1

# arpegio (entra a los 10 s, crece hasta los 37 s)
step = beat / 2; i = 0
while i * step < 86:
    ts = i * step
    if ts >= 10:
        ch = CH[int(ts // CL) % 4] if ts < 81.6 else CH[2]
        m = ch[[0, 2, 1, 3, 2, 1, 3, 2][i % 8]] + 12
        n = int(.9 * SR); tt = np.arange(n) / SR
        g = .045 * min(1, .35 + (ts - 10) / 40) * (1.0 if i % 2 == 0 else .7)
        s = (np.sin(2 * np.pi * hz(m) * tt) + .3 * np.sin(4 * np.pi * hz(m) * tt)) * np.exp(-tt / .22) * np.minimum(1, tt / .004) * g
        pan = .35 if i % 2 == 0 else .65
        add(L, ts, s * (1 - pan)); add(R, ts, s * pan)
        add(R, ts + step * 1.5, s * .35 * (1 - pan)); add(L, ts + step * 1.5, s * .35 * pan)
    i += 1

# pulso suave (método y caso: 37 a 76 s)
b = 0
while b * beat < 76.4:
    ts = b * beat
    if ts >= 37:
        n = int(.3 * SR); tt = np.arange(n) / SR
        f = 45 + 50 * np.exp(-tt / .03)
        kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / .09) * .22
        add(L, ts, kick); add(R, ts, kick)
        n = int(.05 * SR); nz = rng.standard_normal(n); nz = np.diff(nz, prepend=0) * np.exp(-np.arange(n) / SR / .012) * .012
        add(L, ts + beat / 2, nz); add(R, ts + beat / 2, nz * .8)
    b += 1

mix = np.stack([L, R], 1)
mix *= (np.minimum(1, t / 1.5) * np.minimum(1, (DUR - t) / 3.5))[:, None]
mix = np.tanh(mix * 1.6) / 1.6
mix /= np.abs(mix).max() / .8
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "musica.wav")
w = wave.open(out, "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix * 32767).astype("<i2").tobytes()); w.close(); print(out)
