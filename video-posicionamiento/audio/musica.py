# Bases musicales sintetizadas. Uso: python3 audio/musica.py A|B|C  -> audio/musica-A.wav
#   A: synthwave con empuje, 112 BPM   B: house luminoso, 120 BPM   C: beat urbano tech, 92 BPM
import numpy as np, wave, os, sys
OPT = (sys.argv[1] if len(sys.argv) > 1 else "A").upper()
SR, DUR = 44100, 91.0
N = int(SR * DUR); t = np.arange(N) / SR
rng = np.random.default_rng(5)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
L = np.zeros(N); R = np.zeros(N)
def add(start, sig, pan=.5, g=1.0):
    i = int(start * SR)
    if i >= N or i < 0: return
    sig = sig[: N - i]; L[i:i + len(sig)] += sig * g * (1 - pan) * 2; R[i:i + len(sig)] += sig * g * pan * 2
def tt(d): return np.arange(int(d * SR)) / SR
def kick(g=.5):
    x = tt(.32); f = 48 + 110 * np.exp(-x / .028)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / .11) * g
def noise(d, dec, hp=1):
    x = tt(d); n = rng.standard_normal(len(x))
    for _ in range(hp): n = np.diff(n, prepend=0)
    return n * np.exp(-x / dec)
def clap(g=.16): return (noise(.25, .07, 1) + .5 * np.sin(2 * np.pi * 190 * tt(.25)) * np.exp(-tt(.25) / .05)) * g
def hat(g=.03, dec=.02): return noise(.2, dec, 2) * g
def saw(m, d, dec, harm=7, g=.2):
    x = tt(d); f = hz(m); s = sum(np.sin(2 * np.pi * f * k * x) / k for k in range(1, harm + 1))
    return s * np.exp(-x / dec) * np.minimum(1, x / .005) * g
def pluck(m, d=.7, dec=.18, g=.1, bright=.4):
    x = tt(d); f = hz(m)
    return (np.sin(2 * np.pi * f * x) + bright * np.sin(4 * np.pi * f * x) + bright * .5 * np.sin(6 * np.pi * f * x)) * np.exp(-x / dec) * np.minimum(1, x / .003) * g
def pad(ch, d, g=.035):
    x = tt(d + .8); env = np.minimum(1, x / .5) * np.minimum(1, (x[-1] - x) / .8); s = 0
    for m in ch:
        for det in (-.3, .3):
            f = hz(m) * (1 + det / 100); s = s + np.sin(2 * np.pi * f * x) + .4 * np.sin(4 * np.pi * f * x) + .2 * np.sin(6 * np.pi * f * x)
    return s * env * g
def sub808(m, d, g=.3):
    x = tt(d); return np.tanh(np.sin(2 * np.pi * hz(m) * x) * 2) * np.exp(-x / (d * .6)) * np.minimum(1, x / .004) * g

# energía por tramo del video: 0 gancho, 10 presentación, 25 tu empresa, 37 método, 57 caso, 76.5 frase, 81.8 cierre
def lvl(ts):
    if ts < 10: return 1
    if ts < 25: return 2
    if ts < 37: return 2
    if ts < 57: return 3
    if ts < 66.2: return 2
    if ts < 81.6: return 3
    return 4
END = 88.0

if OPT == "A":
    BPM = 112; b = 60 / BPM; bar = 4 * b
    CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; RT = [45, 41, 36, 43]
    nb = int(END / bar)
    for k in range(nb):
        ts = k * bar; e = lvl(ts); c = (k // 2) % 4
        add(ts, pad([m + 12 for m in CH[c]], bar, .02 if e > 1 else .03))
        for s in range(8):  # bajo en corcheas
            if e >= 2 or s % 4 == 0: add(ts + s * b / 2, saw(RT[c] + (12 if s % 4 == 3 else 0), b * .5, .16, 8, .13 if e >= 2 else .09))
        for s in range(16):  # arpegio
            m = CH[c][[0, 1, 2, 1][s % 4]] + 12 + (12 if s % 8 >= 4 else 0)
            add(ts + s * b / 4, pluck(m, .4, .09, .05 if e >= 2 else .03, .7), .3 + .4 * (s % 2))
        for q in range(4):
            if e >= 2: add(ts + q * b, kick(.5 if e >= 3 else .38))
            if e >= 3 and q % 2 == 1: add(ts + q * b, clap())
            if e >= 2: add(ts + q * b + b / 2, hat(.035, .05), .6)
            if e >= 3:
                add(ts + q * b + b / 4, hat(.018), .4); add(ts + q * b + 3 * b / 4, hat(.018), .65)
        if e >= 3 and k % 2 == 0:  # motivo
            for s, m in ((0, 76), (1.5, 74), (2.5, 72), (3.5, 69), (5, 72), (6, 74)):
                add(ts + s * b, pluck(m, 1.0, .3, .07, .3), .55)
    add(nb * bar, pad([57, 60, 64, 69, 72], 3.0, .06)); add(nb * bar, kick(.5)); add(nb * bar, saw(33, 3, 1.2, 6, .16))
elif OPT == "B":
    BPM = 120; b = 60 / BPM; bar = 4 * b
    CH = [[60, 64, 67, 71], [55, 59, 62, 66], [57, 60, 64, 67], [53, 57, 60, 64]]; RT = [36, 43, 45, 41]
    nb = int(END / bar)
    for k in range(nb):
        ts = k * bar; e = lvl(ts); c = (k // 2) % 4
        for s in (0, 3, 6, 10, 12):  # acordes sincopados tipo piano
            if e >= 2 or s in (0, 6, 12):
                for i, m in enumerate(CH[c]): add(ts + s * b / 4, pluck(m, .9, .28, .04, .5), .35 + .1 * i)
        for q in range(4):
            if e >= 2:
                add(ts + q * b, kick(.5 if e >= 3 else .4))
                add(ts + q * b + b / 2, saw(RT[c], b * .45, .12, 6, .16))  # bajo a contratiempo
                add(ts + q * b + b / 2, hat(.04, .06), .6)
            if e >= 3 and q % 2 == 1: add(ts + q * b, clap(.15))
            if e >= 3: add(ts + q * b + b / 4, hat(.015), .4); add(ts + q * b + 3 * b / 4, hat(.02), .65)
        if e == 1: add(ts, pad(CH[c], bar, .03))
        if e >= 2 and k % 2 == 1:  # melodía corta
            for s, m in ((0, 79), (.75, 76), (1.5, 74), (2.5, 76), (3, 72)):
                add(ts + s * b, pluck(m, .8, .2, .06 if e >= 3 else .04, .6), .6)
    add(nb * bar, pad([60, 64, 67, 72, 76], 3.0, .06)); add(nb * bar, kick(.5)); add(nb * bar, saw(36, 3, 1.2, 6, .15))
else:
    BPM = 92; b = 60 / BPM; bar = 4 * b
    CH = [[62, 65, 69, 72], [58, 62, 65, 69], [53, 57, 60, 65], [60, 64, 67, 70]]; RT = [38, 34, 29, 36]
    nb = int(END / bar)
    for k in range(nb):
        ts = k * bar; e = lvl(ts); c = k % 4
        add(ts, pad(CH[c], bar, .028))
        if e >= 2:
            add(ts, sub808(RT[c], b * 1.6, .3)); add(ts + 2.5 * b, sub808(RT[c], b * 1.2, .25))
            add(ts, kick(.5)); add(ts + 2.5 * b, kick(.42))
            add(ts + 2 * b, clap(.2))
            for s in range(8): add(ts + s * b / 2, hat(.03 if s % 2 == 0 else .018), .6)
        if e >= 3:
            add(ts + 1.5 * b, kick(.3))
            for s in range(4): add(ts + 3.5 * b + s * b / 8, hat(.02), .35 + .1 * s)  # redoble
        for s, i in ((0, 3), (.75, 2), (1.5, 1), (2.5, 2), (3.25, 0)):  # campanas
            add(ts + s * b, pluck(CH[c][i] + 12, 1.2, .35, .05 if e >= 2 else .035, .25), .4 + .05 * i)
            add(ts + s * b + .75 * b, pluck(CH[c][i] + 12, 1.0, .3, .018, .25), .7)
    add(nb * bar, pad([62, 65, 69, 74, 77], 3.0, .06)); add(nb * bar, sub808(26, 3, .3)); add(nb * bar, kick(.5))

mix = np.stack([L, R], 1)
mix *= (np.minimum(1, t / .8) * np.minimum(1, (DUR - t) / 1.5))[:, None]
mix = np.tanh(mix * 1.4) / 1.4
mix /= np.abs(mix).max() / .85
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"musica-{OPT}.wav")
w = wave.open(out, "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix * 32767).astype("<i2").tobytes()); w.close(); print(out)
