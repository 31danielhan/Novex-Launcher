package dev.novex.client.core;


/**
 * Novex Client's own screens, drawn the same on every version through {@link Gfx}:
 *
 * <ul>
 *   <li>the HUD editor (Right Shift): drag elements to move them, drag a corner or scroll over one to
 *       resize it, and a Settings button in the middle;
 *   <li>the settings ({@link SettingsPanel}).
 * </ul>
 *
 * Each version's screen forwards its mouse and key events here. Coordinates are GUI-scaled pixels.
 */
public final class ClientGui {
	private static final int TEXT = 0xFFF2F4F5;
	private static final int MUTED = 0xFF8A939C;
	private static final int ACCENT = 0xFF76BA7C;
	private static final int SNAP = 6;

	private boolean settings;
	/** Element being moved or resized in the editor, and how. */
	private Hud.Element held;
	private boolean resizing;
	private float grabX, grabY, startScale, startW;
	/** Guides to draw while snapping: x and y in pixels, or NaN. */
	private float guideX = Float.NaN, guideY = Float.NaN;

	private SettingsPanel panel = new SettingsPanel(this);
	private Hud.Element pending;
	private float pendingBy;

	public ClientGui() {
		NovexCore.editing = true;
	}

	/** Call when the screen closes for good. */
	public void closed() {
		NovexCore.editing = false;
		NovexCore.config.save();
	}

	/** Opens straight on the settings, e.g. from the title screen button. */
	public ClientGui openSettings() {
		settings = true;
		panel = new SettingsPanel(this);
		return this;
	}

	void closeSettings() {
		settings = false;
	}

	/** Esc: steps back inside the settings, then to the editor; the editor closes. Returns true to close the screen. */
	public boolean escape() {
		if (settings) {
			if (!panel.back()) settings = false;
			return false;
		}
		return true;
	}

	/** Typed characters go to the settings search. */
	public void typed(char c) {
		if (settings) panel.typed(c);
	}

	public void backspace() {
		if (settings) panel.backspace();
	}

	/** A size change from the settings for an element still at its default spot, applied on the next frame. */
	void pendingResize(Hud.Element e, float by) {
		pending = e;
		pendingBy = by;
	}

	// ---- Drawing ------------------------------------------------------------------------------

	public void render(Gfx g, Game game, int mx, int my) {
		if (pending != null) {
			Layout l = Hud.layout(pending, g, game);
			l.scale = clampScale(l.scale + pendingBy);
			NovexCore.config.hud.put(pending.id, l);
			NovexCore.config.save();
			pending = null;
		}
		if (settings) panel.render(g, game, mx, my);
		else renderEditor(g, game, mx, my);
	}

	private void renderEditor(Gfx g, Game game, int mx, int my) {
		g.fill(0, 0, g.width(), g.height(), 0x55000000);
		if (!Float.isNaN(guideX)) g.fill((int) guideX, 0, (int) guideX + 1, g.height(), 0x8876BA7C);
		if (!Float.isNaN(guideY)) g.fill(0, (int) guideY, g.width(), (int) guideY + 1, 0x8876BA7C);

		Hud.Element hover = held != null ? held : elementAt(g, game, mx, my);
		for (Hud.Element e : Hud.ELEMENTS) {
			if (!e.enabled()) continue;
			Hud.drawElement(g, game, e, true);
			float[] b = Hud.box(e, g, game, true);
			boolean hot = e == hover;
			Shapes.outline(g, b[0] - 1, b[1] - 1, b[0] + b[2] + 1, b[1] + b[3] + 1, 3, hot ? 1f : 0.75f,
					hot ? ACCENT : 0x55FFFFFF);
			if (hot) {
				// Resize handle on the bottom-right corner.
				int hx = (int) (b[0] + b[2]), hy = (int) (b[1] + b[3]);
				Shapes.round(g, hx - 3, hy - 3, hx + 3, hy + 3, 3, ACCENT);
			}
		}

		// The settings button, in the middle of the screen.
		int[] c = centerButton(g);
		boolean overButton = held == null && inside(mx, my, c);
		Shapes.shadow(g, c[0], c[1], c[0] + c[2], c[1] + c[3], 10, 6, 0x66000000);
		Shapes.round(g, c[0], c[1], c[0] + c[2], c[1] + c[3], 10, overButton ? 0xF0222A32 : 0xE6141A20);
		Shapes.outline(g, c[0], c[1], c[0] + c[2], c[1] + c[3], 10, 1, overButton ? ACCENT : 0x33FFFFFF);
		g.push(c[0] + c[2] / 2f, c[1] + 7, 1.5f);
		centered(g, "Novex", 0, 0, TEXT, true);
		g.pop();
		centered(g, "Settings", c[0] + c[2] / 2, c[1] + 25, overButton ? ACCENT : MUTED, false);

		String hint = "Drag to move. Drag a corner or scroll to resize. Right Shift to close.";
		centered(g, hint, g.width() / 2, g.height() - 14, 0xAAFFFFFF, true);
	}

	private int[] centerButton(Gfx g) {
		int w = 92, h = 38;
		return new int[] {(g.width() - w) / 2, (g.height() - h) / 2, w, h};
	}

	// ---- Input --------------------------------------------------------------------------------

	public void mouseDown(Gfx g, Game game, double mx, double my, int button) {
		if (settings) {
			// Outside the panel: back to the editor.
			if (button == 0 && !panel.mouseDown(mx, my)) closeSettings();
			return;
		}
		if (button != 0) return;
		if (inside(mx, my, centerButton(g))) {
			settings = true;
			panel = new SettingsPanel(this);
			return;
		}
		held = elementAt(g, game, mx, my);
		if (held == null) return;
		float[] b = Hud.box(held, g, game, true);
		resizing = mx >= b[0] + b[2] - 6 && my >= b[1] + b[3] - 6;
		grabX = (float) mx - b[0];
		grabY = (float) my - b[1];
		startScale = Hud.layout(held, g, game).scale;
		startW = b[2];
	}

	public void mouseDrag(Gfx g, Game game, double mx, double my) {
		if (settings || held == null) return;
		float[] b = Hud.box(held, g, game, true);
		Layout l = Hud.layout(held, g, game);
		if (resizing) {
			// Scale from the top-left corner so the dragged corner follows the mouse.
			float width = Math.max(8f, (float) mx - b[0] + (startW - grabX));
			l.scale = clampScale(startScale * width / startW);
		} else {
			float x = (float) mx - grabX, y = (float) my - grabY;
			guideX = guideY = Float.NaN;
			// Snap to the screen edges and center lines.
			float cx = g.width() / 2f, cy = g.height() / 2f;
			if (Math.abs(x + b[2] / 2 - cx) < SNAP) {
				x = cx - b[2] / 2;
				guideX = cx;
			}
			if (Math.abs(y + b[3] / 2 - cy) < SNAP) {
				y = cy - b[3] / 2;
				guideY = cy;
			}
			if (x < SNAP) x = 0;
			if (y < SNAP) y = 0;
			if (g.width() - (x + b[2]) < SNAP) x = g.width() - b[2];
			if (g.height() - (y + b[3]) < SNAP) y = g.height() - b[3];
			l.x = x / g.width();
			l.y = y / g.height();
		}
		NovexCore.config.hud.put(held.id, l);
	}

	public void mouseUp() {
		if (held != null) NovexCore.config.save();
		held = null;
		guideX = guideY = Float.NaN;
	}

	public void scroll(Gfx g, Game game, double mx, double my, double amount) {
		if (settings) {
			panel.scroll(amount);
			return;
		}
		Hud.Element e = elementAt(g, game, mx, my);
		if (e == null) return;
		Layout l = Hud.layout(e, g, game);
		l.scale = clampScale(l.scale + (float) amount * 0.1f);
		NovexCore.config.hud.put(e.id, l);
		NovexCore.config.save();
	}

	private static float clampScale(float s) {
		return Math.max(0.5f, Math.min(3f, Math.round(s * 20) / 20f));
	}

	private Hud.Element elementAt(Gfx g, Game game, double mx, double my) {
		Hud.Element found = null;
		for (Hud.Element e : Hud.ELEMENTS) {
			if (!e.enabled()) continue;
			float[] b = Hud.box(e, g, game, true);
			if (mx >= b[0] - 1 && mx <= b[0] + b[2] + 2 && my >= b[1] - 1 && my <= b[1] + b[3] + 2) found = e;
		}
		return found;
	}

	private static boolean inside(double mx, double my, int[] r) {
		return mx >= r[0] && mx < r[0] + r[2] && my >= r[1] && my < r[1] + r[3];
	}

	// ---- Shapes -------------------------------------------------------------------------------

	/** Smoothly rounded rectangle; see {@link Shapes}. */
	static void round(Gfx g, int x1, int y1, int x2, int y2, int color) {
		Shapes.round(g, x1, y1, x2, y2, 4, color);
	}

	static void outline(Gfx g, int x1, int y1, int x2, int y2, int color) {
		Shapes.outline(g, x1, y1, x2, y2, 4, 1, color);
	}

	/** Shortens text with an ellipsis to fit a width. */
	static String fit(Gfx g, String s, int width) {
		if (g.textWidth(s) <= width) return s;
		while (s.length() > 1 && g.textWidth(s + "...") > width) s = s.substring(0, s.length() - 1);
		return s.trim() + "...";
	}

	static void centered(Gfx g, String s, int cx, int y, int color, boolean shadow) {
		g.text(s, cx - g.textWidth(s) / 2, y, color, shadow);
	}
}
