#!/usr/bin/env python3
"""量单推卡配图：水线 / 安静区 / 人物轮廓 / 每带可压字的宽度。

图是最高优先级——文字范围和水域特效都从这张图里长出来，所以先量。
只读，不改图；输出为终端表格 + `_out/oshi-art/` 下的调试图。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "agent" / "scripts" / "out" / "oshi-art"


def lum(rgb):
    return (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]) / 255.0


def saturation(rgb):
    im = rgb.astype(np.float32) / 255.0
    mx, mn = im.max(axis=2), im.min(axis=2)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)


def hue(rgb):
    im = rgb.astype(np.float32) / 255.0
    r, g, b = im[:, :, 0], im[:, :, 1], im[:, :, 2]
    mx, mn = im.max(axis=2), im.min(axis=2)
    d = mx - mn + 1e-6
    h = np.zeros_like(mx)
    m = mx == r
    h[m] = ((g - b) / d)[m] % 6
    m = mx == g
    h[m] = ((b - r) / d)[m] + 2
    m = mx == b
    h[m] = ((r - g) / d)[m] + 4
    return h * 60.0


def waterline(rgb, x0=0.0, x1=0.7):
    """水面 = 横贯的亮带，且上下平均亮度有明显落差。只在给定 x 区间上量。"""
    L = lum(rgb)
    h, w = L.shape
    sl = L[:, int(x0 * w):int(x1 * w)]
    row = sl.mean(axis=1)
    win = max(4, int(0.05 * h))
    delta = np.array([row[min(h - 1, y + win)] - row[max(0, y - win)] for y in range(h)])
    lo, hi = int(0.10 * h), int(0.60 * h)
    y_jump = lo + int(np.argmax(delta[lo:hi]))
    y_peak = lo + int(np.argmax(row[lo:hi]))
    return y_jump, y_peak, delta[y_jump], row


def cells_of(rgb, n=32):
    L = lum(rgb)
    gy, gx = np.gradient(L)
    g = np.hypot(gx, gy)
    h, w = L.shape
    ch, cw = h // n, w // n
    busy = np.zeros((n, n))
    mean = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            blk = L[i * ch:(i + 1) * ch, j * cw:(j + 1) * cw]
            gb = g[i * ch:(i + 1) * ch, j * cw:(j + 1) * cw]
            busy[i, j] = blk.std() * 2.0 + gb.mean() * 6.0
            mean[i, j] = blk.mean()
    return busy, mean, ch, cw


def ascii_map(a, title, lo=None, hi=None):
    ramp = " .:-=+*#%@"
    lo = a.min() if lo is None else lo
    hi = a.max() if hi is None else hi
    span = (hi - lo) or 1.0
    out = [title]
    for i in range(a.shape[0]):
        out.append(f"{i:2d} |" + "".join(
            ramp[min(9, max(0, int((a[i, j] - lo) / span * 9.999)))] for j in range(a.shape[1])) + "|")
    return "\n".join(out)


def figure(rgb):
    """紫发 + 深色衣物 + 肤色 → 最大连通块 = 她。"""
    from scipy import ndimage
    h, w = rgb.shape[:2]
    s, v, hh = saturation(rgb), lum(rgb), hue(rgb)
    hair = (hh > 235) & (hh < 335) & (s > 0.28) & (v > 0.12)
    dark = (v < 0.30) & (s < 0.50)
    skin = (hh > 5) & (hh < 45) & (s > 0.10) & (s < 0.60) & (v > 0.55)
    mask = ndimage.binary_closing(hair | dark | skin, iterations=4)
    mask[:, : int(0.30 * w)] = False          # 只认右半边，排除水草/沉木
    lab, n = ndimage.label(mask)
    if n:
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        best, bsize = 0, 0
        for idx in range(1, n + 1):
            size = sizes[idx - 1]
            if size < 0.004 * mask.size:
                continue
            ys, xs = np.where(lab == idx)
            if ys.mean() > 0.95 * h:          # 贴底 = 沙地
                continue
            if size > bsize:
                best, bsize = idx, size
        mask = lab == best if best else mask
    return mask


def band_report(rgb, mask, n=16, q=0.28):
    """每带：亮度/对比 + 从左边起能压字的安全宽度。"""
    L = lum(rgb)
    gy, gx = np.gradient(L)
    g = np.hypot(gx, gy)
    h, w = L.shape
    ch = h // n
    thresh = np.percentile(g, q * 100)
    print(f"  （细节阈值 p{int(q*100)} = {thresh:.4f}）")
    print("  带  y范围      均值L  标准差   她左边界   从左侧可压字至   说明")
    for i in range(n):
        sl_L = L[i * ch:(i + 1) * ch]
        sl_g = g[i * ch:(i + 1) * ch]
        # 从 x=0 向右扫，遇到第一列"细节超阈值像素占比 > 8%"就停
        col_busy = (sl_g > thresh).mean(axis=0)
        stop = w
        for j in range(w):
            if col_busy[j] > 0.08:
                stop = j
                break
        # 若首列就超，允许跳过最左 3% 再看（边框效应）
        if stop < 0.03 * w:
            stop = w
            for j in range(int(0.03 * w), w):
                if col_busy[j] > 0.08:
                    stop = j
                    break
        ys, xs = np.where(mask[i * ch:(i + 1) * ch])
        fl = f"{xs.min()/w:6.1%}" if len(xs) else "     -"
        tag = ""
        if i * ch < 0.10 * h:
            tag = "顶部灯斑"
        print(f"  {i:2d}  {i*ch:4d}-{(i+1)*ch:4d}  {sl_L.mean():5.3f}  {sl_L.std():6.3f}   {fl}       {stop:5d} ({stop/w:5.1%})  {tag}")


def main(paths):
    OUT.mkdir(parents=True, exist_ok=True)
    for p in paths:
        p = Path(p)
        rgb = np.array(Image.open(p).convert("RGB"))
        h, w = rgb.shape[:2]
        print("=" * 88)
        print(f"# {p.name}  {w}x{h}  ratio={w/h:.3f}")
        yj, yp, dy, row = waterline(rgb, 0.0, 0.62)
        print(f"水线: 落差最大 y={yj} ({yj/h:.1%})  Δ={dy:+.3f} | 最亮行 y={yp} ({yp/h:.1%}) L={row[yp]:.3f}")
        print(f"      上半 {row[:yj].mean():.3f} → 下半 {row[yj:].mean():.3f}")
        mask = figure(rgb)
        ys, xs = np.where(mask)
        if len(ys):
            print(f"她的包围盒: x {xs.min()}-{xs.max()} ({xs.min()/w:.1%}-{xs.max()/w:.1%})  "
                  f"y {ys.min()}-{ys.max()} ({ys.min()/h:.1%}-{ys.max()/h:.1%})  面积 {mask.mean():.1%}")
        busy, mean, ch, cw = cells_of(rgb)
        print(ascii_map(busy, f"忙乱度 32x32（格 {cw}x{ch}px）：std*2 + |grad|*6"))
        print(ascii_map(mean, "亮度 32x32（0→1）", lo=0.0, hi=1.0))
        band_report(rgb, mask)
        vis = rgb.copy()
        vis[mask] = [255, 0, 0]
        Image.fromarray(vis).save(OUT / f"{p.stem}-mask.png")
        Image.fromarray((busy / max(busy.max(), 1e-6) * 255).astype(np.uint8)).resize(
            (640, 640), Image.NEAREST).save(OUT / f"{p.stem}-busy.png")
        print(f"  调试图 → {OUT}")


if __name__ == "__main__":
    a = sys.argv[1:] or [r"C:\Projects\image2.5\day.png", r"C:\Projects\image2.5\night.png"]
    main(a)
