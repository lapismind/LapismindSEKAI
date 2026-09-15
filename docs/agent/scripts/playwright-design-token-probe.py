"""探针：某个游戏页面里，还有没有残留的旧调色板 hex？design-kit 令牌色生效了吗？

做法：遍历页面所有元素，收集 computed 的 color / background-color / border-*-color，
与两份清单比对：
  - 旧调色板（迁移前的硬编码紫调灰）→ 应该为 0
  - design-kit 浅色令牌真值（由 oklch 算出）→ 应该出现

用法：
  python docs/agent/scripts/playwright-design-token-probe.py <url>
"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1]

# 迁移前的硬编码紫调灰（应彻底消失）
OLD = {
    "#8a8299": "muted 文本（旧）",
    "#333333": "主文本（旧）",
    "#5f586b": "次级文本（旧）",
    "#d8d0e4": "描边（旧）",
    "#a29bb5": "弱化文本（旧）",
    "#f7eff8": "品牌淡底（旧）",
    "#2a2a48": "brand-950（旧，任意值形式）",
}

PROBE = """
() => {
  const seen = { color: {}, bg: {}, border: {} };
  const bump = (bucket, v) => { if (!v) return; seen[bucket][v] = (seen[bucket][v] || 0) + 1; };
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    bump('color', cs.color);
    bump('bg', cs.backgroundColor);
    for (const side of ['Top','Right','Bottom','Left']) {
      const w = cs['border' + side + 'Width'];
      if (w && w !== '0px') bump('border', cs['border' + side + 'Color']);
    }
  }
  return seen;
}
"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1100, "height": 1000})
    page.goto(URL, wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1500)
    seen = page.evaluate(PROBE)
    browser.close()


def to_hex(rgb: str):
    if not rgb or not rgb.startswith("rgb"):
        return None
    nums = rgb[rgb.find("(") + 1 : rgb.find(")")].split(",")
    if len(nums) < 3:
        return None
    if len(nums) == 4 and float(nums[3]) == 0:
        return None  # 全透明，忽略
    return "#%02x%02x%02x" % tuple(int(float(n)) for n in nums[:3])


print(f"页面：{URL}")
hits = {k: 0 for k in OLD}
for bucket, values in seen.items():
    for rgb, n in values.items():
        h = to_hex(rgb)
        if h in OLD:
            hits[h] += n
print("\n旧调色板残留（应为 0）：")
any_hit = False
for h, label in OLD.items():
    if hits[h]:
        any_hit = True
        print(f"  ✗ {h} {label} × {hits[h]}")
if not any_hit:
    print("  ✓ 一处都没有")

print("\n实际出现的文本色（前 10，按出现次数）：")
for rgb, n in sorted(seen["color"].items(), key=lambda kv: -kv[1])[:10]:
    print(f"  {to_hex(rgb) or rgb:<10} × {n}   ({rgb})")
print("\n实际出现的描边色（前 8）：")
for rgb, n in sorted(seen["border"].items(), key=lambda kv: -kv[1])[:8]:
    print(f"  {to_hex(rgb) or rgb:<10} × {n}   ({rgb})")
