package dev.novex.client.core;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The settings window: a sidebar for navigation, a searchable grid of module cards (click a card to
 * switch it, or its gear for options), a page of options per module, and the client's own settings.
 * Drawn at a fixed size and scaled down to fit small windows.
 *
 * <p>The look is adapted from OneConfig by Polyfrost (LGPL-3.0, conveyed here under the GPL-3.0):
 * its Polyfrosted Dark colors (internal/ui/themes/Impls.kt), its radii (Radii.kt: 6/8/16/20), its
 * 1391x700 window with a 264-wide sidebar (Shell.kt, Sidebar.kt), mod cards with an inset footer
 * (screens/Mods.kt) and pages that slide a fifth of the way in while fading (Shell.kt). Sizes are
 * theirs at 0.4x, Minecraft GUI pixels being much larger than their dp.
 */
final class SettingsPanel {
	static final int W = 556, H = 280;
	private static final int HEAD = 34, SIDE = 106, GRID_X = SIDE + 10, GRID_TOP = HEAD + 24, COLS = 4, GAP = 6;
	private static final int CARD_H = 60;
	/** OneConfig's radii at 0.4x: window, card, control. */
	private static final float R_LG = 8, R_MD = 6.4f, R_SM = 3.2f;

	private static final int BG = 0xF211171C;
	private static final int SIDEBAR = 0xF2151C22;
	private static final int CARD = 0xFF1A2228;
	private static final int CARD_HOT = 0xFF222C33;
	private static final int BAR = 0xFF353B42;
	private static final int BAR_HOT = 0xFF434A52;
	private static final int ON = 0xFF2B4BFF;
	private static final int ON_HOT = 0xFF4562FF;
	private static final int OFF = 0xFF3A4048;
	private static final int OFF_HOT = 0xFF4A535C;
	private static final int TEXT = 0xFFD5DBFF;
	private static final int SOFT = 0xFFB4B9D6;
	private static final int MUTED = 0xFF757883;
	private static final int LINE = 0x1AFFFFFF;

	private enum Tab { MODS, SETTINGS }

	private final ClientGui owner;
	private Tab tab = Tab.MODS;
	private Module.Category filter;
	private String search = "";
	private Module page;
	private float scroll, scrollTarget;
	private long opened = System.nanoTime(), last = System.nanoTime();
	/** Hover fade per control, 0 to 1. */
	private final Map<String, Float> fades = new HashMap<String, Float>();
	private final List<Hit> hits = new ArrayList<Hit>();
	private float px, py, ps = 1f;
	/** Page slide, as in OneConfig: the new page comes in from a fifth of the way across. */
	private Object shownPage = Tab.MODS;
	private long pageChanged;
	private int pageDir = 1;
	private float slide;

	SettingsPanel(ClientGui owner) {
		this.owner = owner;
	}

	// ---- Drawing ------------------------------------------------------------------------------

	void render(Gfx g, Game game, int mouseX, int mouseY) {
		long now = System.nanoTime();
		float dt = Math.min(0.1f, (now - last) / 1e9f);
		last = now;
		float open = ease(Math.min(1f, (now - opened) / 1.8e8f));
		scroll += (scrollTarget - scroll) * Math.min(1f, dt * 14f);

		g.fill(0, 0, g.width(), g.height(), alpha(0x99000000, open));
		float fit = Math.min(1f, Math.min((g.width() - 12f) / W, (g.height() - 12f) / H));
		ps = fit * (0.96f + 0.04f * open);
		px = (g.width() - W * ps) / 2f;
		py = (g.height() - H * ps) / 2f + (1 - open) * 8;
		int mx = (int) ((mouseX - px) / ps), my = (int) ((mouseY - py) / ps);
		hits.clear();

		Object current = tab == Tab.SETTINGS ? tab : page != null ? page : Tab.MODS;
		if (current != shownPage) {
			pageDir = page != null && shownPage == Tab.MODS ? 1 : -1;
			shownPage = current;
			pageChanged = now;
		}
		slide = (1 - ease(Math.min(1f, (now - pageChanged) / 2.2e8f))) * 24 * pageDir;
		Shapes.density(g.pixels() * ps);
		g.push(px, py, ps);
		Shapes.shadow(g, 0, 0, W, H, R_LG, 12, alpha(0x6B000000, open));
		Shapes.round(g, 0, 0, W, H, R_LG, BG);
		Shapes.round(g, 0, 0, SIDE, H, R_LG, 0, 0, R_LG, SIDEBAR);
		g.fill(SIDE, 0, SIDE + 1, H, LINE);
		Shapes.outline(g, 0, 0, W, H, R_LG, 1, LINE);
		header(g, mx, my, dt);
		sidebar(g, mx, my, dt);
		g.push(slide, 0, 1);
		int smx = mx - Math.round(slide);
		if (tab == Tab.SETTINGS) clientSettings(g, smx, my, dt);
		else if (page != null) options(g, page, smx, my, dt);
		g.pop();
		g.pop();

		// The grid scrolls under a clip, set in screen pixels outside the panel's transform.
		if (tab == Tab.MODS && page == null) grid(g, game, mx, my, dt);
	}

	/** Back arrow and page title, the search box and the close button, above the content. */
	private void header(Gfx g, int mx, int my, float dt) {
		boolean grid = tab == Tab.MODS && page == null;
		String title = tab == Tab.SETTINGS ? "Settings" : page != null ? page.label : "Modules";
		int tx = GRID_X;
		if (page != null) {
			float f = fade("back", hot(mx, my, tx - 2, 9, 16, 18), dt);
			ClientGui.centered(g, "<", tx + 6, 14, mix(MUTED, TEXT, f), false);
			hits.add(new Hit(tx - 2, 9, 16, 18, new Runnable() {
				public void run() {
					page = null;
				}
			}));
			tx += 16;
		}
		g.push(tx, 13, 1.3f);
		g.text(title, 0, 0, TEXT, true);
		g.pop();
		if (grid) {
			int sw = 120, sx = W - 34 - sw;
			Shapes.round(g, sx, 9, sx + sw, 25, R_SM, 0xFF1A2229);
			Shapes.outline(g, sx, 9, sx + sw, 25, R_SM, 1, LINE);
			lens(g, sx + 9, 17);
			boolean caret = (System.currentTimeMillis() / 500) % 2 == 0;
			if (search.isEmpty()) g.text("Search modules...", sx + 17, 13, MUTED, false);
			else g.text(ClientGui.fit(g, search, sw - 26) + (caret ? "_" : ""), sx + 17, 13, TEXT, false);
		}
		float f = fade("close", hot(mx, my, W - 26, 8, 18, 18), dt);
		if (f > 0.02f) Shapes.round(g, W - 26, 8, W - 8, 26, R_SM, alpha(0xFF232D32, f));
		ClientGui.centered(g, "x", W - 17, 13, mix(SOFT, TEXT, f), false);
		hits.add(new Hit(W - 26, 8, 18, 18, new Runnable() {
			public void run() {
				owner.closeSettings();
			}
		}));
	}

	/** A small magnifying glass. */
	private static void lens(Gfx g, int cx, int cy) {
		g.fill(cx - 3, cy - 4, cx + 2, cy - 3, MUTED);
		g.fill(cx - 3, cy + 1, cx + 2, cy + 2, MUTED);
		g.fill(cx - 4, cy - 3, cx - 3, cy + 1, MUTED);
		g.fill(cx + 2, cy - 3, cx + 3, cy + 1, MUTED);
		g.fill(cx + 2, cy + 2, cx + 3, cy + 3, MUTED);
		g.fill(cx + 3, cy + 3, cx + 4, cy + 4, MUTED);
	}

	/** The launcher logo's purple. */
	static final int LOGO = 0xFF6D3FD9;

	/**
	 * The Novex logo in a box `size` pixels square: the launcher's mark, two rounded triangles. Where
	 * the version can't draw icons, the older N tile.
	 */
	static void logo(Gfx g, float x, float y, float size) {
		g.push(x, y, size / Icons.BIG);
		// The mark is a little shorter than its box, so it's nudged down to sit centred.
		boolean drawn = g.symbol(Icons.LOGO, 0, -1, true, LOGO);
		g.pop();
		if (drawn) return;
		g.push(x, y, size / 16f);
		Shapes.round(g, 0, 0, 16, 16, 5, ON);
		for (int i = 0; i < 10; i++) {
			g.fill(3, 3 + i, 6, 4 + i, 0xFFFFFFFF);
			g.fill(10, 3 + i, 13, 4 + i, 0xFFFFFFFF);
			g.fill(5 + i * 6 / 10, 3 + i, 8 + i * 6 / 10, 4 + i, 0xFFFFFFFF);
		}
		g.pop();
	}

	private void sidebar(Gfx g, int mx, int my, float dt) {
		logo(g, 14, 11, 16);
		g.push(35, 14, 1.25f);
		spaced(g, "NOVEX", 0, 0, TEXT, 1, true);
		g.pop();

		int y = 38;
		y = nav(g, "Edit HUD", "minecraft:painting", Icons.LAYOUT_DASHBOARD, false, y, mx, my, dt, new Runnable() {
			public void run() {
				owner.editHud();
			}
		});
		y = section(g, "MODULES", y);
		y = nav(g, "Modules", "minecraft:chest", Icons.LAYOUT_GRID, tab == Tab.MODS, y, mx, my, dt, new Runnable() {
			public void run() {
				tab = Tab.MODS;
				page = null;
			}
		});
		y = section(g, "CLIENT", y);
		nav(g, "Settings", "minecraft:comparator", Icons.SETTINGS, tab == Tab.SETTINGS, y, mx, my, dt, new Runnable() {
			public void run() {
				tab = Tab.SETTINGS;
				page = null;
			}
		});

		g.fill(8, H - 34, SIDE - 8, H - 33, LINE);
		g.text("Novex Client", 12, H - 26, SOFT, false);
		g.text("Right Shift", 12, H - 15, MUTED, false);
	}

	private static int section(Gfx g, String label, int y) {
		g.push(12, y + 9, 0.75f);
		spaced(g, label, 0, 0, MUTED, 1, false);
		g.pop();
		return y + 18;
	}

	private int nav(Gfx g, String label, String icon, int glyph, boolean on, int y, int mx, int my, float dt, Runnable action) {
		float f = fade("nav" + label, hot(mx, my, 6, y, SIDE - 12, 18), dt);
		if (on) Shapes.round(g, 6, y, SIDE - 6, y + 18, R_SM, ON);
		else if (f > 0.02f) Shapes.round(g, 6, y, SIDE - 6, y + 18, R_SM, alpha(0x1FD5DBFF, f));
		if (!g.symbol(glyph, 12, y + 3, false, on ? TEXT : SOFT)) {
			g.push(12, y + 3, 0.75f);
			g.icon(icon, 0, 0);
			g.pop();
		}
		g.text(label, 28, y + 5, on ? TEXT : SOFT, false);
		hits.add(new Hit(6, y, SIDE - 12, 18, action));
		return y + 20;
	}

	private List<Module> shown() {
		List<Module> list = new ArrayList<Module>();
		String q = search.trim().toLowerCase();
		for (Module m : NovexCore.modules) {
			if (filter != null && m.category != filter) continue;
			if (!q.isEmpty() && !m.label.toLowerCase().contains(q) && !m.description.toLowerCase().contains(q)) continue;
			list.add(m);
		}
		return list;
	}

	private int cardWidth() {
		return (W - GRID_X - 14 - (COLS - 1) * GAP) / COLS;
	}

	/** What the grid shows (tab, filter, search) and when that last changed, for the cards' cascade. */
	private String gridKey;
	private long gridAt;

	private void grid(Gfx g, Game game, int mx, int my, float dt) {
		g.push(px, py, ps);
		chips(g, mx, my, dt);
		g.pop();

		List<Module> list = shown();
		int cw = cardWidth();
		int rows = (list.size() + COLS - 1) / COLS;
		int viewH = H - GRID_TOP - 8;
		float maxScroll = Math.max(0, rows * (CARD_H + GAP) - GAP - viewH);
		scrollTarget = Math.max(0, Math.min(maxScroll, scrollTarget));
		scroll = Math.max(0, Math.min(maxScroll, scroll));

		g.clip((int) (px + GRID_X * ps), (int) (py + GRID_TOP * ps), (int) Math.ceil(px + (W - 8) * ps),
				(int) Math.ceil(py + (H - 8) * ps));
		g.push(px, py, ps);
		if (list.isEmpty()) ClientGui.centered(g, "No modules match \"" + search + "\"", GRID_X + (W - GRID_X) / 2, GRID_TOP + 40, MUTED, false);
		boolean inView = my >= GRID_TOP && my < H - 8;
		// A new set of cards cascades in: each rises into place a moment after the one before.
		String key = tab + "|" + filter + "|" + search;
		long now = System.nanoTime();
		if (!key.equals(gridKey)) {
			gridKey = key;
			gridAt = now;
		}
		float since = (now - gridAt) / 1e9f;
		for (int i = 0; i < list.size(); i++) {
			int x = GRID_X + (i % COLS) * (cw + GAP);
			float rise = Math.max(0f, Math.min(1f, (since - i * 0.035f) / 0.45f));
			float u = 1 - rise;
			rise = 1 - u * u * u * u * u;
			int y = GRID_TOP + (i / COLS) * (CARD_H + GAP) - Math.round(scroll) + Math.round(12 * (1 - rise));
			if (y > H || y + CARD_H < GRID_TOP) continue;
			card(g, list.get(i), x, y, cw, inView ? mx : -1, my, dt);
		}
		if (maxScroll > 0) {
			// Scroll bar.
			int track = viewH, bar = Math.max(20, (int) (track * viewH / (track + maxScroll)));
			int by = GRID_TOP + (int) ((track - bar) * (scroll / maxScroll));
			g.fill(W - 11, GRID_TOP, W - 9, GRID_TOP + track, 0x14FFFFFF);
			g.fill(W - 11, by, W - 9, by + bar, 0x55FFFFFF);
		}
		g.pop();
		g.noClip();
	}

	/** Category filters under the title. */
	private void chips(Gfx g, int mx, int my, float dt) {
		int x = GRID_X, y = HEAD + 2;
		Module.Category[] cats = Module.Category.values();
		for (int i = -1; i < cats.length; i++) {
			final Module.Category cat = i < 0 ? null : cats[i];
			String label = cat == null ? "All" : cat.label;
			int w = g.textWidth(label) + 14;
			boolean on = filter == cat;
			float f = fade("chip" + label, hot(mx, my, x, y, w, 15), dt);
			Shapes.round(g, x, y, x + w, y + 15, R_SM, on ? ON : mix(0xFF1E272D, 0xFF27323A, f));
			if (!on) Shapes.outline(g, x, y, x + w, y + 15, R_SM, 1, LINE);
			g.text(label, x + 7, y + 4, on ? TEXT : SOFT, false);
			hits.add(new Hit(x, y, w, 15, new Runnable() {
				public void run() {
					filter = cat;
					scrollTarget = 0;
				}
			}));
			x += w + 4;
		}
	}

	/** Icon on top, name bar below: colored when on. Click to switch; the gear opens options. */
	private void card(Gfx g, final Module m, int x, int y, int w, int mx, int my, float dt) {
		final Config c = NovexCore.config;
		boolean on = m.get(c);
		int bar = y + CARD_H - 17;
		float f = fade("card" + m, hot(mx, my, x, y, w, CARD_H), dt);
		float sw = fade("switch" + m, on, dt);
		// OneConfig's inset footer: the card is one rounded tile, the name bar a smaller tile inside it.
		Shapes.round(g, x, y, x + w, y + CARD_H, R_MD, mix(CARD, CARD_HOT, f));
		Shapes.outline(g, x, y, x + w, y + CARD_H, R_MD, 1, LINE);
		Shapes.round(g, x + 2, bar, x + w - 2, y + CARD_H - 2, R_SM, R_SM, R_MD - 2, R_MD - 2,
				mix(mix(0xFF27323A, 0xFF2E3A43, f), mix(ON, ON_HOT, f), sw));
		icon(g, m, x + w / 2f - 16, y + 5 - f, on ? TEXT : SOFT);
		ClientGui.centered(g, ClientGui.fit(g, m.label, w - 8), x + w / 2, bar + 5, on ? TEXT : SOFT, false);

		// The gear is first in the hit list, so it wins over the card behind it.
		int gx = x + w - 15, gy = y + 3;
		float fg = fade("gear" + m, hot(mx, my, gx, gy, 12, 12), dt);
		if (f > 0.05f) {
			if (fg > 0.02f) Shapes.round(g, gx, gy, gx + 12, gy + 12, R_SM, alpha(0xFF2E3A43, fg));
			gear(g, gx + 6, gy + 6);
		} else if (on) {
			Shapes.round(g, gx + 5, gy + 3, gx + 9, gy + 7, 2, ON_HOT);
		}
		gridHit(gx, gy, 12, 12, new Runnable() {
			public void run() {
				page = m;
			}
		});
		gridHit(x, y, w, CARD_H, saving(new Runnable() {
			public void run() {
				m.set(c, !m.get(c));
			}
		}));
	}

	/** Now playing's page: what's playing, which app, how far, and previous / play-pause / next. */
	private void nowPlaying(Gfx g, int x, int w, int mx, int my, float dt) {
		NowPlaying.keep(true);
		int y = rowY, h = 64;
		Shapes.round(g, x, y, x + w, y + h, R_MD, CARD);
		Shapes.outline(g, x, y, x + w, y + h, R_MD, 1, LINE);
		boolean real = NowPlaying.present();
		String title = !NowPlaying.supported() ? "Needs macOS" : real ? NowPlaying.title : "Nothing playing";
		String sub = !real ? "Start music or a video in any app." : NowPlaying.artist.isEmpty() ? "" : NowPlaying.artist;
		g.symbol(Icons.MUSIC, x + 10, y + 10, false, real && NowPlaying.playing ? ON_HOT : MUTED);
		g.text(ClientGui.fit(g, title, w - 150), x + 28, y + 9, TEXT, false);
		g.text(ClientGui.fit(g, sub, w - 150), x + 28, y + 20, SOFT, false);
		if (real) {
			String where = "Playing in " + NowPlaying.app;
			g.text(where, x + w - 10 - g.textWidth(where), y + 9, MUTED, false);
		}
		// Progress, with the time on either side.
		double d = NowPlaying.duration(), at = NowPlaying.position();
		int px1 = x + 40, px2 = x + w - 40, py = y + 38;
		Shapes.round(g, px1, py, px2, py + 3, 1.5f, 0xFF27323A);
		if (d > 0) Shapes.round(g, px1, py, px1 + Math.max(3, Math.round((px2 - px1) * (float) (at / d))), py + 3, 1.5f, ON);
		g.text(NowPlaying.time(at), x + 10, py - 3, MUTED, false);
		String total = d > 0 ? NowPlaying.time(d) : "--:--";
		g.text(total, x + w - 10 - g.textWidth(total), py - 3, MUTED, false);
		// Previous, play/pause (the big one), next.
		int cx = x + w / 2, by = y + 45;
		mediaButton(g, "prev", Icons.SKIP_BACK, cx - 40, by, 16, false, real, mx, my, dt, new Runnable() {
			public void run() {
				NowPlaying.previous();
			}
		});
		mediaButton(g, "play", NowPlaying.playing ? Icons.PAUSE : Icons.PLAY, cx - 9, by - 1, 18, true, real, mx, my, dt, new Runnable() {
			public void run() {
				NowPlaying.toggle();
			}
		});
		mediaButton(g, "next", Icons.SKIP_FORWARD, cx + 24, by, 16, false, real, mx, my, dt, new Runnable() {
			public void run() {
				NowPlaying.next();
			}
		});
		rowY += h + 6;
	}

	private void mediaButton(Gfx g, String key, int icon, int x, int y, int size, boolean main, boolean live, int mx, int my, float dt, Runnable action) {
		float f = fade("media" + key, live && hot(mx, my, x, y, size, size), dt);
		if (main) Shapes.round(g, x, y, x + size, y + size, size / 2f, live ? mix(ON, ON_HOT, f) : OFF);
		else if (f > 0.02f) Shapes.round(g, x, y, x + size, y + size, size / 2f, alpha(0x1FD5DBFF, f));
		int c = live ? (main ? 0xFFFFFFFF : mix(SOFT, TEXT, f)) : MUTED;
		g.symbol(icon, x + (size - Icons.SMALL) / 2, y + (size - Icons.SMALL) / 2, false, c);
		if (live) hits.add(new Hit(x, y, size, size, action));
	}

	/** A card button, clickable only where it shows inside the scrolling grid. */
	private void gridHit(int x, int y, int w, int h, Runnable action) {
		int top = Math.max(y, GRID_TOP), bottom = Math.min(y + h, H - 8);
		if (bottom > top) hits.add(new Hit(x, top, w, bottom - top, action));
	}

	/**
	 * The module's line icon in a 32-pixel box. Where the version can't draw icons, its item at 2x, or
	 * its first letter on a tile where items can't be drawn yet.
	 */
	private static void icon(Gfx g, Module m, float x, float y, int color) {
		int off = (32 - Icons.BIG) / 2;
		if (g.symbol(m.glyph, Math.round(x) + off, Math.round(y) + off, true, color)) return;
		g.push(x, y, 2f);
		boolean drawn = g.icon(m.icon, 0, 0);
		if (!drawn) {
			Shapes.round(g, 0, 0, 16, 16, 4, 0xFF2A3036);
			ClientGui.centered(g, m.label.substring(0, 1), 8, 4, SOFT, false);
		}
		g.pop();
	}

	/** A small cog: a ring with four teeth. */
	private static void gear(Gfx g, int cx, int cy) {
		int c = 0xFFE6E9EC;
		g.fill(cx - 3, cy - 2, cx + 3, cy + 2, c);
		g.fill(cx - 2, cy - 3, cx + 2, cy + 3, c);
		g.fill(cx - 1, cy - 4, cx + 1, cy + 4, c);
		g.fill(cx - 4, cy - 1, cx + 4, cy + 1, c);
		g.fill(cx - 1, cy - 1, cx + 1, cy + 1, CARD_HOT);
	}

	// ---- Module page --------------------------------------------------------------------------

	private int rowY;

	private void options(Gfx g, final Module m, int mx, int my, float dt) {
		final Config c = NovexCore.config;
		int x = GRID_X, w = W - GRID_X - 12;

		icon(g, m, x, HEAD + 6, TEXT);
		g.push(x + 40, HEAD + 9, 1.4f);
		g.text(m.label, 0, 0, TEXT, true);
		g.pop();
		g.text(m.description, x + 40, HEAD + 26, MUTED, false);
		g.fill(x, HEAD + 44, x + w, HEAD + 45, LINE);

		rowY = HEAD + 52;
		toggleRow(g, "Enabled", m.get(c), x, w, mx, my, dt, new Runnable() {
			public void run() {
				m.set(c, !m.get(c));
			}
		});
		switch (m) {
			case ZOOM:
				cycleRow(g, "Zoom strength", Math.round(c.zoomFactor) + "x", x, w, mx, my, dt, new Runnable() {
					public void run() {
						c.zoomFactor = c.zoomFactor >= 8 ? 2 : c.zoomFactor * 2;
					}
				});
				break;
			case MOTION_BLUR:
				sliderRow(g, "Strength", c.motionBlurStrength, x, w, new java.util.function.IntConsumer() {
					public void accept(int v) {
						c.motionBlurStrength = v;
					}
				});
				break;
			case CAMERA_STABILIZE:
				sliderRow(g, "Strength", c.cameraStabilizeStrength, x, w, new java.util.function.IntConsumer() {
					public void accept(int v) {
						c.cameraStabilizeStrength = v;
					}
				});
				break;
			case SMOOTH_EATING:
				cycleRow(g, "Style", c.eatingStyle == 1 ? "Ripping" : "Smooth", x, w, mx, my, dt, new Runnable() {
					public void run() {
						c.eatingStyle = c.eatingStyle == 1 ? 0 : 1;
					}
				});
				break;
			case MUSIC:
				if (c.music) nowPlaying(g, x, w, mx, my, dt);
				break;
			case SIDEBAR:
				toggleRow(g, "Score numbers", c.sidebarNumbers, x, w, mx, my, dt, new Runnable() {
					public void run() {
						c.sidebarNumbers = !c.sidebarNumbers;
					}
				});
				break;
			case BUILD_LIMIT:
				stepperRow(g, "Build height", String.valueOf(c.buildHeight), x, w, mx, my, dt, new Runnable() {
					public void run() {
						c.buildHeight = Math.max(1, c.buildHeight - 1);
					}
				}, new Runnable() {
					public void run() {
						c.buildHeight = Math.min(255, c.buildHeight + 1);
					}
				});
				break;
			default:
		}
		for (final Hud.Element e : Hud.ELEMENTS) {
			if (e.module != m) continue;
			Layout l = c.hud.get(e.id);
			final float scale = l == null ? 1f : l.scale;
			stepperRow(g, "Size", Math.round(scale * 100) + "%", x, w, mx, my, dt, new Runnable() {
				public void run() {
					resize(e, -0.1f);
				}
			}, new Runnable() {
				public void run() {
					resize(e, 0.1f);
				}
			});
			cycleRow(g, "Position", "Reset", x, w, mx, my, dt, new Runnable() {
				public void run() {
					c.hud.remove(e.id);
				}
			});
		}
	}

	/** Size changes from the options page keep the element where it is. */
	private void resize(Hud.Element e, float by) {
		Layout l = NovexCore.config.hud.get(e.id);
		if (l == null) {
			owner.pendingResize(e, by);
			return;
		}
		l.scale = Math.max(0.5f, Math.min(3f, Math.round((l.scale + by) * 20) / 20f));
	}

	private void label(Gfx g, String text, int x) {
		g.text(text, x + 8, rowY + 6, SOFT, false);
	}

	private void rowBox(Gfx g, int x, int w) {
		// OneConfig's setting rows: a component tile with a hairline border.
		Shapes.round(g, x, rowY, x + w, rowY + 20, R_SM * 1.5f, 0xFF1A2229);
		Shapes.outline(g, x, rowY, x + w, rowY + 20, R_SM * 1.5f, 1, LINE);
	}

	private void toggleRow(Gfx g, String text, boolean on, int x, int w, int mx, int my, float dt, Runnable action) {
		rowBox(g, x, w);
		label(g, text, x);
		// OneConfig's switch: a pill whose thumb slides across as its color fades to the accent.
		int bw = 18, bh = 10, bx = x + w - bw - 6, by = rowY + 5;
		float f = fade("row" + text, hot(mx, my, bx - 2, rowY + 2, bw + 4, 16), dt);
		float t = ease(fade("knob" + text, on, dt));
		Shapes.round(g, bx, by, bx + bw, by + bh, bh / 2f, mix(mix(0xFF232D32, 0xFF2C3840, f), mix(ON, ON_HOT, f), t));
		if (t < 0.98f) Shapes.outline(g, bx, by, bx + bw, by + bh, bh / 2f, 1, alpha(LINE, 1 - t));
		float kx = bx + 2 + (bw - bh) * t;
		Shapes.round(g, kx, by + 2, kx + bh - 4, by + bh - 2, (bh - 4) / 2f, 0xFFFFFFFF);
		hits.add(new Hit(bx - 2, rowY + 2, bw + 4, 16, saving(action)));
		rowY += 24;
	}

	private void cycleRow(Gfx g, String text, String value, int x, int w, int mx, int my, float dt, Runnable action) {
		rowBox(g, x, w);
		label(g, text, x);
		int bw = Math.max(70, g.textWidth(value) + 16), bx = x + w - bw - 3;
		float f = fade("row" + text, hot(mx, my, bx, rowY + 3, bw, 14), dt);
		Shapes.round(g, bx, rowY + 3, bx + bw, rowY + 17, R_SM, mix(0xFF232D32, 0xFF2C3840, f));
		ClientGui.centered(g, value, bx + bw / 2, rowY + 6, TEXT, false);
		hits.add(new Hit(bx, rowY + 3, bw, 14, saving(action)));
		rowY += 24;
	}

	private void stepperRow(Gfx g, String text, String value, int x, int w, int mx, int my, float dt, Runnable down, Runnable up) {
		rowBox(g, x, w);
		label(g, text, x);
		int bx = x + w - 73;
		for (int i = 0; i < 2; i++) {
			int sx = i == 0 ? bx : bx + 56;
			float f = fade("step" + text + i, hot(mx, my, sx, rowY + 3, 14, 14), dt);
			Shapes.round(g, sx, rowY + 3, sx + 14, rowY + 17, R_SM, mix(0xFF232D32, 0xFF2C3840, f));
			ClientGui.centered(g, i == 0 ? "-" : "+", sx + 7, rowY + 6, TEXT, false);
			hits.add(new Hit(sx, rowY + 3, 14, 14, saving(i == 0 ? down : up)));
		}
		ClientGui.centered(g, value, bx + 35, rowY + 6, TEXT, false);
		rowY += 24;
	}

	/** A 0-100 track; clicking it sets the value to the nearest 5. */
	private void sliderRow(Gfx g, String text, int value, int x, int w, final java.util.function.IntConsumer set) {
		rowBox(g, x, w);
		label(g, text, x);
		int bw = 105, bx = x + w - bw - 33, step = bw / 21;
		Shapes.round(g, bx, rowY + 8, bx + bw, rowY + 12, 2, 0xFF232D32);
		if (value > 0) Shapes.round(g, bx, rowY + 8, bx + bw * value / 100, rowY + 12, 2, ON);
		float kx = bx + bw * value / 100f;
		Shapes.round(g, kx - 3, rowY + 7, kx + 3, rowY + 13, 3, 0xFFFFFFFF);
		ClientGui.centered(g, value + "%", x + w - 16, rowY + 6, TEXT, false);
		for (int i = 0; i <= 20; i++) {
			final int v = i * 5;
			hits.add(new Hit(bx + i * step, rowY + 3, step, 14, saving(new Runnable() {
				public void run() {
					set.accept(v);
				}
			})));
		}
		rowY += 24;
	}

	private static Runnable saving(final Runnable action) {
		return new Runnable() {
			public void run() {
				action.run();
				NovexCore.config.save();
				NovexCore.changed();
			}
		};
	}

	// ---- Settings tab -------------------------------------------------------------------------

	private void clientSettings(Gfx g, int mx, int my, float dt) {
		final Config c = NovexCore.config;
		int x = GRID_X, w = W - GRID_X - 12;
		rowY = HEAD + 8;
		toggleRow(g, "Custom home page", c.customHome, x, w, mx, my, dt, new Runnable() {
			public void run() {
				c.customHome = !c.customHome;
			}
		});
		toggleRow(g, "Title screen button", c.titleButton, x, w, mx, my, dt, new Runnable() {
			public void run() {
				c.titleButton = !c.titleButton;
			}
		});
		cycleRow(g, "HUD layout", "Reset", x, w, mx, my, dt, new Runnable() {
			public void run() {
				c.hud.clear();
			}
		});
		rowBox(g, x, w);
		label(g, "Menu key", x);
		String key = "Right Shift (change in Controls)";
		g.text(key, x + w - 8 - g.textWidth(key), rowY + 6, MUTED, false);
		rowY += 24;
		g.text("Novex Client shows information only: no reach, hitbox, auto-click or ESP.", x, rowY + 8, MUTED, false);
	}

	// ---- Input --------------------------------------------------------------------------------

	/** Returns false when the click landed outside the panel. */
	boolean mouseDown(double mouseX, double mouseY) {
		float x = (float) ((mouseX - px) / ps), y = (float) ((mouseY - py) / ps);
		if (x < 0 || y < 0 || x > W || y > H) return false;
		for (Hit h : new ArrayList<Hit>(hits)) {
			if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) {
				h.action.run();
				break;
			}
		}
		return true;
	}

	void scroll(double amount) {
		if (tab == Tab.MODS && page == null) scrollTarget -= (float) amount * 40f;
	}

	void typed(char c) {
		if (tab != Tab.MODS || c < 32 || search.length() > 24) return;
		search += c;
		page = null;
		scrollTarget = 0;
	}

	void backspace() {
		if (!search.isEmpty()) search = search.substring(0, search.length() - 1);
	}

	/** Esc on a module page goes back to the grid first. Returns true when there was somewhere to go back to. */
	boolean back() {
		if (page != null) {
			page = null;
			return true;
		}
		if (!search.isEmpty()) {
			search = "";
			return true;
		}
		return false;
	}

	// ---- Helpers ------------------------------------------------------------------------------

	private float fade(String key, boolean hot, float dt) {
		Float v = fades.get(key);
		float f = v == null ? 0f : v;
		f += ((hot ? 1f : 0f) - f) * Math.min(1f, dt * 11f);
		fades.put(key, f);
		return f;
	}

	private static boolean hot(int mx, int my, int x, int y, int w, int h) {
		return mx >= x && mx < x + w && my >= y && my < y + h;
	}

	private static float ease(float t) {
		return 1 - (1 - t) * (1 - t) * (1 - t);
	}

	static int mix(int a, int b, float t) {
		int r = 0;
		for (int shift = 0; shift < 32; shift += 8) {
			int ca = (a >>> shift) & 0xFF, cb = (b >>> shift) & 0xFF;
			r |= Math.round(ca + (cb - ca) * t) << shift;
		}
		return r;
	}

	static int alpha(int color, float t) {
		int a = Math.round(((color >>> 24) & 0xFF) * t);
		return (a << 24) | (color & 0xFFFFFF);
	}

	/** Letter-spaced text, the way the labels on the bars are set. Returns its width. */
	static int spaced(Gfx g, String s, int x, int y, int color, int spacing, boolean shadow) {
		int cx = x;
		for (int i = 0; i < s.length(); i++) {
			String ch = s.substring(i, i + 1);
			g.text(ch, cx, y, color, shadow);
			cx += g.textWidth(ch) + spacing;
		}
		return cx - x - spacing;
	}

	static int spacedWidth(Gfx g, String s, int spacing) {
		int w = 0;
		for (int i = 0; i < s.length(); i++) w += g.textWidth(s.substring(i, i + 1)) + spacing;
		return w - spacing;
	}

	static void centeredSpaced(Gfx g, String s, int cx, int y, int color, int spacing) {
		spaced(g, s, cx - spacedWidth(g, s, spacing) / 2, y, color, spacing, false);
	}

	private static final class Hit {
		final int x, y, w, h;
		final Runnable action;

		Hit(int x, int y, int w, int h, Runnable action) {
			this.x = x;
			this.y = y;
			this.w = w;
			this.h = h;
			this.action = action;
		}
	}
}
