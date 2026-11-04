package dev.novex.client.core;

/**
 * Smooth rounded shapes from plain rectangle fills, so every version draws them the same way. Corners
 * are drawn row by row at a quarter of a GUI pixel, with a partly transparent pixel where the curve
 * crosses each row (anti-aliasing). The straight middle is one fill, so a shape costs a few dozen fills.
 */
final class Shapes {
	/** Sub-pixel steps per GUI pixel. */
	private static final int Q = 4;

	/** Rounded rectangle with one radius for every corner. */
	static void round(Gfx g, float x1, float y1, float x2, float y2, float r, int color) {
		round(g, x1, y1, x2, y2, r, r, r, r, color);
	}

	/** Rounded rectangle with radii top-left, top-right, bottom-right, bottom-left. */
	static void round(Gfx g, float x1, float y1, float x2, float y2, float tl, float tr, float br, float bl, int color) {
		float max = Math.min(x2 - x1, y2 - y1) / 2f;
		tl = Math.min(tl, max);
		tr = Math.min(tr, max);
		br = Math.min(br, max);
		bl = Math.min(bl, max);
		g.push(x1, y1, 1f / Q);
		int w = Math.round((x2 - x1) * Q), h = Math.round((y2 - y1) * Q);
		int top = Math.round(Math.max(tl, tr) * Q), bottom = Math.round(Math.max(bl, br) * Q);
		// Straight middle.
		if (h - top - bottom > 0) g.fill(0, top, w, h - bottom, color);
		for (int y = 0; y < top; y++) row(g, y, w, inset(tl * Q, tl * Q - y - 0.5f), inset(tr * Q, tr * Q - y - 0.5f), color);
		for (int y = h - bottom; y < h; y++) {
			float d = y + 0.5f - (h - bottom);
			row(g, y, w, inset(bl * Q, d - (bottom - bl * Q)), inset(br * Q, d - (bottom - br * Q)), color);
		}
		g.pop();
	}

	/** Rounded outline, `t` GUI pixels thick. */
	static void outline(Gfx g, float x1, float y1, float x2, float y2, float r, float t, int color) {
		g.push(x1, y1, 1f / Q);
		int w = Math.round((x2 - x1) * Q), h = Math.round((y2 - y1) * Q);
		float ro = Math.min(r, Math.min(x2 - x1, y2 - y1) / 2f) * Q;
		float ri = Math.max(0, ro - t * Q);
		int th = Math.round(t * Q);
		for (int y = 0; y < h; y++) {
			// Distance into the corner zone from the top or bottom edge.
			float dy = y < ro ? ro - y - 0.5f : y >= h - ro ? y + 0.5f - (h - ro) : -1;
			float outer = dy >= 0 ? inset(ro, dy) : 0;
			if (y < th || y >= h - th) {
				row(g, y, w, outer, outer, color);
				continue;
			}
			// Inner edge: the inner curve is offset by the thickness.
			// The inner curve shares the outer one's center, with the radius reduced by the thickness.
			float inner = dy >= 0 && ri > 0 ? th + inset(ri, dy) : th;
			int a = (int) Math.ceil(outer), b = Math.max(a, (int) Math.floor(inner));
			if (b > a) {
				g.fill(a, y, b, y + 1, color);
				g.fill(w - b, y, w - a, y + 1, color);
			}
			edge(g, outer, y, color, false, w);
		}
		g.pop();
	}

	/** A soft shadow: rounded rings that fade outwards. */
	static void shadow(Gfx g, float x1, float y1, float x2, float y2, float r, float size, int color) {
		int steps = Math.max(1, Math.round(size));
		for (int i = steps; i >= 1; i--) {
			float a = (1f - (float) i / (steps + 1)) / steps * 1.6f;
			round(g, x1 - i, y1 - i + size / 3, x2 + i, y2 + i + size / 3, r + i, alpha(color, a));
		}
	}

	/** How far in from the side the curve sits, for a corner of radius r at height dy above its center. */
	private static float inset(float r, float dy) {
		if (r <= 0 || dy <= 0) return 0;
		if (dy >= r) return r;
		return r - (float) Math.sqrt(r * r - dy * dy);
	}

	private static void row(Gfx g, int y, int w, float left, float right, int color) {
		int a = (int) Math.ceil(left), b = w - (int) Math.ceil(right);
		if (b > a) g.fill(a, y, b, y + 1, color);
		edge(g, left, y, color, false, w);
		edge(g, right, y, color, true, w);
	}

	/** The partly covered pixel where the curve crosses a row. */
	private static void edge(Gfx g, float inset, int y, int color, boolean right, int w) {
		int px = (int) Math.ceil(inset) - 1;
		float cover = (float) Math.ceil(inset) - inset;
		if (px < 0 || cover <= 0.02f) return;
		int c = alpha(color, cover);
		if (right) g.fill(w - px - 1, y, w - px, y + 1, c);
		else g.fill(px, y, px + 1, y + 1, c);
	}

	static int alpha(int color, float t) {
		int a = Math.round(((color >>> 24) & 0xFF) * Math.max(0, Math.min(1, t)));
		return (a << 24) | (color & 0xFFFFFF);
	}
}
