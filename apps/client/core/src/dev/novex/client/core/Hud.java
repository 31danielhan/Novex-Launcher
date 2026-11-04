package dev.novex.client.core;

import java.util.ArrayList;
import java.util.List;

/**
 * The HUD: a set of elements the player can move and resize in the editor. Text sits on a soft dark
 * plate so it reads on any terrain.
 */
public final class Hud {
	static final int TEXT = 0xFFF2F4F5;
	static final int DIM = 0xFFA9B2BA;
	static final int KEY_DOWN = 0xCCF2F4F5;
	static final int ACCENT = 0xFF76BA7C;
	static final int LOW = 0xFFF0766A;

	/** One movable piece of the HUD. Sizes are unscaled pixels. */
	public abstract static class Element {
		public final String id;
		public final Module module;

		Element(String id, Module module) {
			this.id = id;
			this.module = module;
		}

		abstract int width(Gfx g, Game game, boolean preview);

		abstract int height(Gfx g, Game game, boolean preview);

		/** Draws at (0, 0); the caller has already moved and scaled. */
		abstract void draw(Gfx g, Game game, boolean preview);

		/** Where it goes before the player moves it, in pixels. */
		abstract float[] defaultSpot(Gfx g, Game game);

		public boolean enabled() {
			return module.get(NovexCore.config);
		}
	}

	public static final List<Element> ELEMENTS = new ArrayList<Element>();

	static {
		ELEMENTS.add(new Line("fps", Module.FPS, 0) {
			String text(Game game, boolean preview) {
				return game.fps() + " FPS";
			}
		});
		ELEMENTS.add(new Line("cps", Module.CPS, 1) {
			String text(Game game, boolean preview) {
				return Clicks.left() + " | " + Clicks.right() + " CPS";
			}
		});
		ELEMENTS.add(new Line("ping", Module.PING, 2) {
			String text(Game game, boolean preview) {
				int ping = game.active() ? game.ping() : -1;
				return ping >= 0 ? ping + " ms" : preview ? "24 ms" : null;
			}
		});
		ELEMENTS.add(new Coordinates());
		ELEMENTS.add(new Keystrokes());
		ELEMENTS.add(new Armor());
		ELEMENTS.add(new Effects());
	}

	public static Layout layout(Element e, Gfx g, Game game) {
		Layout l = NovexCore.config.hud.get(e.id);
		if (l != null) return l;
		float[] spot = e.defaultSpot(g, game);
		Float size = NovexCore.config.hudSize.get(e.id);
		return new Layout(spot[0] / g.width(), spot[1] / g.height(), size == null ? 1f : size);
	}

	/** Pixel box of an element on screen: x, y, width, height, kept inside the screen. */
	public static float[] box(Element e, Gfx g, Game game, boolean preview) {
		Layout l = layout(e, g, game);
		float w = e.width(g, game, preview) * l.scale;
		float h = e.height(g, game, preview) * l.scale;
		float x = Math.max(0, Math.min(g.width() - w, l.x * g.width()));
		float y = Math.max(0, Math.min(g.height() - h, l.y * g.height()));
		return new float[] {x, y, w, h};
	}

	static void drawElement(Gfx g, Game game, Element e, boolean preview) {
		float[] b = box(e, g, game, preview);
		g.push(b[0], b[1], layout(e, g, game).scale);
		e.draw(g, game, preview);
		g.pop();
	}

	public static void draw(Gfx g, Game game) {
		// The editor draws its own copy, so it can show elements even on the title screen.
		if (!game.active() || NovexCore.editing) return;
		for (Element e : ELEMENTS) {
			if (e.enabled() && e.height(g, game, false) > 0) drawElement(g, game, e, false);
		}
		Config c = NovexCore.config;
		if (c.buildLimit) buildLimit(g, game);
		if (NovexCore.zooming) {
			String z = "Zoom " + Math.round(c.zoomFactor) + "x";
			g.text(z, (g.width() - g.textWidth(z)) / 2, g.height() / 2 + 12, ACCENT, true);
		}
	}

	/** Warns under the crosshair once the player is within 10 blocks of the limit. */
	private static void buildLimit(Gfx g, Game game) {
		int left = game.blocksToBuildLimit();
		if (left < 0 || left > 10) return;
		String s = left == 0 ? "Build limit reached" : left == 1 ? "1 block to build limit" : left + " blocks to build limit";
		g.text(s, (g.width() - g.textWidth(s)) / 2, g.height() / 2 + 24, left <= 3 ? LOW : TEXT, true);
	}

	private static int textColor() {
		return 0xFF000000 | NovexCore.config.hudTextColor;
	}

	private static int plateColor() {
		return Math.round(NovexCore.config.hudPlateOpacity * 2.55f) << 24;
	}

	private static boolean shadow() {
		return NovexCore.config.hudShadow;
	}

	static void plate(Gfx g, String text, int y) {
		if (NovexCore.config.hudPlates) Shapes.plate(g, 0, y, 4 + g.textWidth(text), y + g.lineHeight() + 2, plateColor());
		g.text(text, 2, y + 2, textColor(), shadow());
	}

	/** A single line of text on a plate; the default spots stack down the top-left corner. */
	private abstract static class Line extends Element {
		private final int slot;

		Line(String id, Module m, int slot) {
			super(id, m);
			this.slot = slot;
		}

		abstract String text(Game game, boolean preview);

		int width(Gfx g, Game game, boolean preview) {
			String t = text(game, preview);
			return t == null ? 0 : 4 + g.textWidth(t);
		}

		int height(Gfx g, Game game, boolean preview) {
			return text(game, preview) == null ? 0 : g.lineHeight() + 2;
		}

		void draw(Gfx g, Game game, boolean preview) {
			String t = text(game, preview);
			if (t != null) plate(g, t, 0);
		}

		float[] defaultSpot(Gfx g, Game game) {
			return new float[] {2, 2 + slot * (g.lineHeight() + 4)};
		}
	}

	private static final class Coordinates extends Element {
		Coordinates() {
			super("coordinates", Module.COORDINATES);
		}

		private String[] lines(Game game) {
			Config c = NovexCore.config;
			String f = "%." + c.coordinatesDecimals + "f";
			String at = game.active()
					? String.format(java.util.Locale.ROOT, f + ", " + f + ", " + f, game.x(), game.y(), game.z())
					: "128, 64, -256";
			if (!c.coordinatesFacing) return new String[] {at};
			return new String[] {at, "Facing " + (game.active() ? game.facing() : "north")};
		}

		int width(Gfx g, Game game, boolean preview) {
			int w = 0;
			for (String l : lines(game)) w = Math.max(w, g.textWidth(l));
			return 4 + w;
		}

		int height(Gfx g, Game game, boolean preview) {
			return lines(game).length * (g.lineHeight() + 2) + 2;
		}

		void draw(Gfx g, Game game, boolean preview) {
			int y = 0;
			for (String l : lines(game)) {
				plate(g, l, y);
				y += g.lineHeight() + 4;
			}
		}

		float[] defaultSpot(Gfx g, Game game) {
			return new float[] {2, 2 + 3 * (g.lineHeight() + 4)};
		}
	}

	private static final class Keystrokes extends Element {
		private static final int S = 18, GAP = 2;

		Keystrokes() {
			super("keystrokes", Module.KEYSTROKES);
		}

		int width(Gfx g, Game game, boolean preview) {
			return 3 * S + 2 * GAP;
		}

		int height(Gfx g, Game game, boolean preview) {
			Config c = NovexCore.config;
			return 2 * S + GAP + (c.keystrokesMouse ? S + GAP : 0) + (c.keystrokesJump ? 12 + GAP : 0);
		}

		void draw(Gfx g, Game game, boolean preview) {
			boolean live = game.active();
			key(g, live && game.down(Game.Key.UP), "W", S + GAP, 0, S, S);
			key(g, live && game.down(Game.Key.LEFT), "A", 0, S + GAP, S, S);
			key(g, live && game.down(Game.Key.DOWN), "S", S + GAP, S + GAP, S, S);
			key(g, live && game.down(Game.Key.RIGHT), "D", 2 * (S + GAP), S + GAP, S, S);
			Config c = NovexCore.config;
			int row = 2 * (S + GAP);
			if (c.keystrokesMouse) {
				int half = (3 * S + GAP) / 2;
				key(g, live && game.down(Game.Key.ATTACK), String.valueOf(Clicks.left()), 0, row, half, S);
				key(g, live && game.down(Game.Key.USE), String.valueOf(Clicks.right()), half + GAP, row, half, S);
				row += S + GAP;
			}
			if (c.keystrokesJump) key(g, live && game.down(Game.Key.JUMP), "Jump", 0, row, 3 * S + 2 * GAP, 12);
		}

		float[] defaultSpot(Gfx g, Game game) {
			return new float[] {2, 2 + 5 * (g.lineHeight() + 4) + 4};
		}

		private static void key(Gfx g, boolean down, String label, int x, int y, int w, int h) {
			if (down || NovexCore.config.hudPlates) Shapes.plate(g, x, y, x + w, y + h, down ? KEY_DOWN : plateColor());
			int color = down ? 0xFF15181B : textColor();
			g.text(label, x + (w - g.textWidth(label)) / 2, y + (h - g.lineHeight()) / 2 + 1, color, !down && shadow());
		}
	}

	/** Durability next to each piece, right-aligned so it hugs the right edge by default. */
	private static final class Armor extends Element {
		private static final int W = 64, ROW = 18;

		Armor() {
			super("armor", Module.ARMOR);
		}

		private List<Game.Piece> pieces(Game game, boolean preview) {
			List<Game.Piece> p = game.active() ? game.armor() : new ArrayList<Game.Piece>();
			if (p.isEmpty() && preview) {
				// Placeholder rows so the element can be placed with empty slots.
				for (String s : new String[] {"363", "528", "495", "429"}) p.add(new Game.Piece(null, s, false));
			}
			return p;
		}

		int width(Gfx g, Game game, boolean preview) {
			return W;
		}

		int height(Gfx g, Game game, boolean preview) {
			return pieces(game, preview).size() * ROW;
		}

		void draw(Gfx g, Game game, boolean preview) {
			int y = 0;
			for (Game.Piece p : pieces(game, preview)) {
				if (p.stack != null) g.item(p.stack, W - 16, y);
				else Shapes.plate(g, W - 15, y + 1, W - 1, y + 15, plateColor());
				g.text(p.text, W - 20 - g.textWidth(p.text), y + 4, p.low ? LOW : textColor(), true);
				y += ROW;
			}
		}

		float[] defaultSpot(Gfx g, Game game) {
			return new float[] {g.width() - W - 4, g.height() / 2f - 40};
		}
	}

	private static final class Effects extends Element {
		private static final int W = 96;

		Effects() {
			super("effects", Module.EFFECTS);
		}

		private List<Game.Effect> list(Game game, boolean preview) {
			List<Game.Effect> l = game.active() ? game.effects() : new ArrayList<Game.Effect>();
			if (l.isEmpty() && preview) l.add(new Game.Effect("Speed", 1, 1800, false));
			return l;
		}

		int width(Gfx g, Game game, boolean preview) {
			return W;
		}

		int height(Gfx g, Game game, boolean preview) {
			return list(game, preview).size() * (2 * g.lineHeight() + 5);
		}

		void draw(Gfx g, Game game, boolean preview) {
			int lh = g.lineHeight();
			int y = 0;
			for (Game.Effect e : list(game, preview)) {
				String name = e.amplifier > 0 ? e.name + " " + (e.amplifier + 1) : e.name;
				String time = e.infinite ? "\u221e" : formatTicks(e.ticks);
				g.text(name, W - g.textWidth(name), y, textColor(), true);
				g.text(time, W - g.textWidth(time), y + lh + 1, DIM, true);
				y += 2 * lh + 5;
			}
		}

		float[] defaultSpot(Gfx g, Game game) {
			return new float[] {g.width() - W - 4, g.height() / 2f + 60};
		}
	}

	private static String formatTicks(int ticks) {
		int s = ticks / 20;
		return String.format("%d:%02d", s / 60, s % 60);
	}

	/** Armor durability text and whether it's nearly broken. */
	public static Game.Piece piece(Object stack, boolean damageable, int max, int damage, int count) {
		String text = damageable ? String.valueOf(max - damage) : (count > 1 ? String.valueOf(count) : "");
		return new Game.Piece(stack, text, damageable && damage * 4 > max * 3);
	}
}
