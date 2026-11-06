package dev.novex.client.core;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The settings window: a Mods tab with a filterable, searchable grid of module cards (icon, name,
 * Options, and an Enabled/Disabled bar), a page of options per module, and a Settings tab for the
 * client itself. Drawn at a fixed size and scaled down to fit small windows.
 */
final class SettingsPanel {
	static final int W = 440, H = 270;
	private static final int HEAD = 34, SIDE = 124, GRID_X = SIDE + 10, GRID_TOP = HEAD + 34, COLS = 3, GAP = 8;
	private static final int CARD_H = 100;

	private static final int BG = 0xF00E1115;
	private static final int HEADER = 0xF0090B0E;
	private static final int CARD = 0xE61B2026;
	private static final int CARD_HOT = 0xF0252B33;
	private static final int BAR = 0xFF353B42;
	private static final int BAR_HOT = 0xFF434A52;
	private static final int ON = 0xFF2BAA5A;
	private static final int ON_HOT = 0xFF33C267;
	private static final int OFF = 0xFFC0264A;
	private static final int OFF_HOT = 0xFFD83258;
	private static final int BLUE = 0xFF3C82F6;
	private static final int TEXT = 0xFFF2F4F5;
	private static final int SOFT = 0xFFC9CED3;
	private static final int MUTED = 0xFF7F8891;
	private static final int LINE = 0x1FFFFFFF;

	private enum Tab { MODS, SETTINGS }

	/** Filter chips: label, category (null for all) and color. */
	private static final Object[][] CHIPS = {
		{"ALL", null, BLUE},
		{"HUD", Module.Category.HUD, 0xFF2F5F9E},
		{"VISUAL", Module.Category.VISUAL, 0xFF6A4FB0},
		{"GAMEPLAY", Module.Category.GAMEPLAY, 0xFF2A7F6F},
	};

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

		g.push(px, py, ps);
		Shapes.shadow(g, 0, 0, W, H, 12, 10, alpha(0x90000000, open));
		Shapes.round(g, 0, 0, W, H, 12, BG);
		Shapes.round(g, 0, 0, W, HEAD, 12, 12, 0, 0, HEADER);
		g.fill(0, HEAD, W, HEAD + 1, LINE);
		Shapes.outline(g, 0, 0, W, H, 12, 1, 0x26FFFFFF);
		header(g, mx, my, dt);
		sidebar(g, mx, my, dt);
		if (tab == Tab.SETTINGS) clientSettings(g, mx, my, dt);
		else if (page != null) options(g, page, mx, my, dt);
		g.pop();

		// The grid scrolls under a clip, set in screen pixels outside the panel's transform.
		if (tab == Tab.MODS && page == null) grid(g, game, mx, my, dt);
	}

	private void header(Gfx g, int mx, int my, float dt) {
		logo(g, 12, 9);
		g.push(34, 13, 1.3f);
		int w = spaced(g, "NOVEX", 0, 0, TEXT, 1, true);
		spaced(g, "CLIENT", w + 4, 0, SOFT, 1, false);
		g.pop();
		int x = 168;
		for (Tab t : Tab.values()) {
			final Tab target = t;
			String label = t == Tab.MODS ? "MODS" : "SETTINGS";
			int bw = spacedWidth(g, label, 2) + 22;
			float f = fade("tab" + t, hot(mx, my, x, 8, bw, 18), dt);
			int fill = t == tab ? 0xFF3A4048 : mix(0xFF1A1E23, 0xFF2A3036, f);
			Shapes.round(g, x, 8, x + bw, 26, 7, fill);
			Shapes.outline(g, x, 8, x + bw, 26, 7, 1, t == tab ? 0x40FFFFFF : 0x22FFFFFF);
			spaced(g, label, x + 11, 13, t == tab ? MUTED : SOFT, 2, false);
			hits.add(new Hit(x, 8, bw, 18, new Runnable() {
				public void run() {
					tab = target;
					page = null;
				}
			}));
			x += bw + 8;
		}
		// Close.
		float f = fade("close", hot(mx, my, W - 26, 8, 18, 18), dt);
		Shapes.round(g, W - 26, 8, W - 8, 26, 7, mix(0xFF2A3036, 0xFF4A535C, f));
		Shapes.outline(g, W - 26, 8, W - 8, 26, 7, 1, 0x33FFFFFF);
		ClientGui.centered(g, "x", W - 17, 13, TEXT, true);
		hits.add(new Hit(W - 26, 8, 18, 18, new Runnable() {
			public void run() {
				owner.closeSettings();
			}
		}));
	}

	/** The Novex mark: a rounded tile with an N cut from two slanted bars. */
	private static void logo(Gfx g, int x, int y) {
		Shapes.round(g, x, y, x + 16, y + 16, 5, 0xFF6D4AE0);
		for (int i = 0; i < 10; i++) {
			g.fill(x + 3, y + 3 + i, x + 6, y + 4 + i, 0xFFFFFFFF);
			g.fill(x + 10, y + 3 + i, x + 13, y + 4 + i, 0xFFFFFFFF);
			g.fill(x + 5 + i * 6 / 10, y + 3 + i, x + 8 + i * 6 / 10, y + 4 + i, 0xFFFFFFFF);
		}
	}

	private void sidebar(Gfx g, int mx, int my, float dt) {
		g.fill(SIDE, HEAD + 1, SIDE + 1, H, LINE);
		spaced(g, "PROFILE", 10, HEAD + 10, MUTED, 1, false);
		Shapes.round(g, 6, HEAD + 22, SIDE - 6, HEAD + 40, 6, 0xFF2A3036);
		g.text("Default", 12, HEAD + 27, TEXT, false);
		Shapes.round(g, SIDE - 15, HEAD + 27, SIDE - 11, HEAD + 35, 2, 0xFF6D4AE0);

		int y = H - 52;
		float f = fade("reset", hot(mx, my, 8, y, SIDE - 16, 18), dt);
		Shapes.round(g, 8, y, SIDE - 8, y + 18, 7, mix(0xFF1A1E23, 0xFF2A3036, f));
		Shapes.outline(g, 8, y, SIDE - 8, y + 18, 7, 1, 0x33FFFFFF);
		centeredSpaced(g, "RESET HUD", SIDE / 2, y + 5, SOFT, 1);
		hits.add(new Hit(8, y, SIDE - 16, 18, new Runnable() {
			public void run() {
				NovexCore.config.hud.clear();
				NovexCore.config.save();
			}
		}));
		y += 24;
		f = fade("edit", hot(mx, my, 8, y, SIDE - 16, 20), dt);
		Shapes.shadow(g, 8, y, SIDE - 8, y + 20, 8, 4, alpha(0x553C82F6, 0.4f + 0.6f * f));
		Shapes.round(g, 8, y, SIDE - 8, y + 20, 8, mix(0xFF2F6FD6, BLUE, f));
		centeredSpaced(g, "EDIT HUD LAYOUT", SIDE / 2, y + 6, TEXT, 1);
		hits.add(new Hit(8, y, SIDE - 16, 20, new Runnable() {
			public void run() {
				owner.closeSettings();
			}
		}));
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
		for (int i = 0; i < list.size(); i++) {
			int x = GRID_X + (i % COLS) * (cw + GAP);
			int y = GRID_TOP + (i / COLS) * (CARD_H + GAP) - Math.round(scroll);
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

	private void chips(Gfx g, int mx, int my, float dt) {
		int x = GRID_X, y = HEAD + 10;
		for (Object[] chip : CHIPS) {
			final String label = (String) chip[0];
			final Module.Category cat = (Module.Category) chip[1];
			int color = (Integer) chip[2];
			int w = spacedWidth(g, label, 2) + 16;
			boolean on = filter == cat;
			float f = fade("chip" + label, hot(mx, my, x, y, w, 16), dt);
			Shapes.round(g, x, y, x + w, y + 16, 8, on ? color : mix(alpha(color, 0.45f), alpha(color, 0.75f), f));
			spaced(g, label, x + 8, y + 4, on ? TEXT : SOFT, 2, false);
			hits.add(new Hit(x, y, w, 16, new Runnable() {
				public void run() {
					filter = cat;
					scrollTarget = 0;
				}
			}));
			x += w + 5;
		}
		// Search box.
		int sx = x + 4, sw = W - 10 - sx;
		Shapes.round(g, sx, y, sx + sw, y + 16, 8, 0xFF15191D);
		Shapes.outline(g, sx, y, sx + sw, y + 16, 8, 1, 0x33FFFFFF);
		boolean caret = (System.currentTimeMillis() / 500) % 2 == 0;
		if (search.isEmpty()) g.text("search...", sx + 6, y + 4, MUTED, false);
		else g.text(ClientGui.fit(g, search, sw - 14) + (caret ? "_" : ""), sx + 6, y + 4, TEXT, false);
	}

	private void card(Gfx g, final Module m, int x, int y, int w, int mx, int my, float dt) {
		final Config c = NovexCore.config;
		boolean on = m.get(c);
		float f = fade("card" + m, hot(mx, my, x, y, w, CARD_H), dt);
		if (f > 0.02f) Shapes.shadow(g, x, y, x + w, y + CARD_H, 8, 4, alpha(0x50000000, f));
		Shapes.round(g, x, y, x + w, y + CARD_H, 8, mix(CARD, CARD_HOT, f));

		// Icon, drawn at 2x and lifted a little on hover.
		icon(g, m, x + w / 2f - 16, y + 12 - 2 * f);
		g.push(x + w / 2f, y + 50, 1.1f);
		ClientGui.centered(g, ClientGui.fit(g, m.label, (int) ((w - 10) / 1.1f)), 0, 0, on ? SOFT : MUTED, false);
		g.pop();

		// Options bar with a gear section on the right; both open the module's page.
		int oy = y + 66;
		float fo = fade("opt" + m, hot(mx, my, x, oy, w, 15), dt);
		g.fill(x, oy, x + w, oy + 15, mix(BAR, BAR_HOT, fo));
		g.fill(x + w - 18, oy, x + w - 17, oy + 15, 0x33000000);
		centeredSpaced(g, "OPTIONS", x + (w - 18) / 2, oy + 4, TEXT, 2);
		gear(g, x + w - 9, oy + 7);
		gridHit(x, oy, w, 15, new Runnable() {
			public void run() {
				page = m;
			}
		});

		// Enabled / disabled bar.
		int sy = y + 83;
		float fs = fade("state" + m, hot(mx, my, x, sy, w, 17), dt);
		Shapes.round(g, x, sy, x + w, y + CARD_H, 0, 0, 8, 8, on ? mix(ON, ON_HOT, fs) : mix(OFF, OFF_HOT, fs));
		Shapes.outline(g, x, y, x + w, y + CARD_H, 8, 1, alpha(0x30FFFFFF, 0.6f + 0.4f * f));
		centeredSpaced(g, on ? "ENABLED" : "DISABLED", x + w / 2, sy + 5, TEXT, 2);
		gridHit(x, sy, w, 17, new Runnable() {
			public void run() {
				m.set(c, !m.get(c));
				c.save();
				NovexCore.changed();
			}
		});
	}

	/** A card button, clickable only where it shows inside the scrolling grid. */
	private void gridHit(int x, int y, int w, int h, Runnable action) {
		int top = Math.max(y, GRID_TOP), bottom = Math.min(y + h, H - 8);
		if (bottom > top) hits.add(new Hit(x, top, w, bottom - top, action));
	}

	/** The module's item at 2x, or its first letter on a tile where items can't be drawn yet. */
	private static void icon(Gfx g, Module m, float x, float y) {
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
		g.fill(cx - 1, cy - 1, cx + 1, cy + 1, BAR);
	}

	// ---- Module page --------------------------------------------------------------------------

	private int rowY;

	private void options(Gfx g, final Module m, int mx, int my, float dt) {
		final Config c = NovexCore.config;
		int x = GRID_X, w = W - GRID_X - 12;
		float f = fade("back", hot(mx, my, x, HEAD + 10, 54, 16), dt);
		Shapes.round(g, x, HEAD + 10, x + 54, HEAD + 26, 8, mix(0xFF2A3036, 0xFF3A4048, f));
		spaced(g, "< BACK", x + 8, HEAD + 14, TEXT, 1, false);
		hits.add(new Hit(x, HEAD + 10, 54, 16, new Runnable() {
			public void run() {
				page = null;
			}
		}));

		icon(g, m, x, HEAD + 34);
		g.push(x + 40, HEAD + 37, 1.4f);
		g.text(m.label, 0, 0, TEXT, true);
		g.pop();
		g.text(m.description, x + 40, HEAD + 54, MUTED, false);
		g.fill(x, HEAD + 72, x + w, HEAD + 73, LINE);

		rowY = HEAD + 80;
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
		Shapes.round(g, x, rowY, x + w, rowY + 20, 6, 0xFF181C21);
	}

	private void toggleRow(Gfx g, String text, boolean on, int x, int w, int mx, int my, float dt, Runnable action) {
		rowBox(g, x, w);
		label(g, text, x);
		int bw = 70, bx = x + w - bw - 3;
		float f = fade("row" + text, hot(mx, my, bx, rowY + 3, bw, 14), dt);
		Shapes.round(g, bx, rowY + 3, bx + bw, rowY + 17, 7, on ? mix(ON, ON_HOT, f) : mix(OFF, OFF_HOT, f));
		centeredSpaced(g, on ? "ENABLED" : "DISABLED", bx + bw / 2, rowY + 6, TEXT, 1);
		hits.add(new Hit(bx, rowY + 3, bw, 14, saving(action)));
		rowY += 24;
	}

	private void cycleRow(Gfx g, String text, String value, int x, int w, int mx, int my, float dt, Runnable action) {
		rowBox(g, x, w);
		label(g, text, x);
		int bw = Math.max(70, g.textWidth(value) + 16), bx = x + w - bw - 3;
		float f = fade("row" + text, hot(mx, my, bx, rowY + 3, bw, 14), dt);
		Shapes.round(g, bx, rowY + 3, bx + bw, rowY + 17, 7, mix(BAR, BAR_HOT, f));
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
			Shapes.round(g, sx, rowY + 3, sx + 14, rowY + 17, 7, mix(BAR, BAR_HOT, f));
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
		Shapes.round(g, bx, rowY + 7, bx + bw, rowY + 13, 3, OFF);
		if (value > 0) Shapes.round(g, bx, rowY + 7, bx + bw * value / 100, rowY + 13, 3, ON);
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
		g.push(x, HEAD + 12, 1.3f);
		g.text("Client settings", 0, 0, TEXT, true);
		g.pop();
		rowY = HEAD + 34;
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
		f += ((hot ? 1f : 0f) - f) * Math.min(1f, dt * 16f);
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
