package dev.novex.client.core;

import java.util.ArrayList;
import java.util.List;

/**
 * Novex's own title screen, shown instead of Minecraft's when Custom home page is on: laid out like
 * Minecraft's, with the Novex logo over Singleplayer, Multiplayer, Novex Client, Options and Quit, over
 * the version's own menu background (the panorama where it has one). Drawn the same on every version
 * through {@link Gfx}.
 *
 * It moves: the logo drifts down into place as it fades in and the buttons follow one after another;
 * a purple glow breathes behind the logo; a hovered button's icon nudges over; and a click sends a
 * ripple out from the cursor before the button acts.
 */
final class HomeMenu {
	private static final int CARD = 0xE611171C, LINE = 0x1AFFFFFF, TEXT = 0xFFD5DBFF, SOFT = 0xFFB4B9D6,
			MUTED = 0xFF757883, ON = 0xFF2B4BFF;
	private static final int BUTTON = 22;
	/** Seconds: the intro, each button's delay after the one before, and the ripple before a click acts. */
	private static final float INTRO = 0.6f, STAGGER = 0.07f, RIPPLE = 0.4f, ACT_AFTER = 0.16f;

	private final ClientGui owner;
	private final List<int[]> hits = new ArrayList<int[]>();
	private final List<Runnable> actions = new ArrayList<Runnable>();
	private final float[] fades = new float[8];
	private long last, opened;

	/** The last click: which button, where, when; and the action waiting for its ripple. */
	private int rippleButton = -1;
	private float rippleX, rippleY;
	private long rippleAt;
	private Runnable pending;

	HomeMenu(ClientGui owner) {
		this.owner = owner;
	}

	/** Plays the intro again, e.g. coming back from the settings. */
	void replay() {
		opened = 0;
	}

	void render(Gfx g, int mx, int my) {
		long now = System.nanoTime();
		float dt = last == 0 ? 0f : Math.min(0.1f, (now - last) / 1e9f);
		last = now;
		if (opened == 0) opened = now;
		float time = (now - opened) / 1e9f;
		hits.clear();
		actions.clear();
		if (pending != null && (now - rippleAt) / 1e9f >= ACT_AFTER) {
			Runnable run = pending;
			pending = null;
			run.run();
		}

		// Minecraft's layout: the logo centred near the top, a column of buttons under it, and
		// Options and Quit side by side at the bottom of the column.
		g.fill(0, 0, g.width(), g.height(), SettingsPanel.alpha(0x30000000, ease(time / INTRO)));
		int cx = g.width() / 2, top = g.height() / 4;

		// The Novex logo: the launcher's mark and the letter-spaced wordmark, centred together. It
		// drifts down into place as it fades in; then a glow behind the mark slowly breathes.
		float in = ease(time / INTRO);
		float big = 2f;
		int word = SettingsPanel.spacedWidth(g, "NOVEX", 1);
		float total = 16 * big + 8 + word * big;
		float lx = cx - total / 2f, ly = top - 30 - 10 * (1 - in);
		// A slow, smooth breath: eased at both ends so it never snaps between brighter and dimmer.
		float wave = 0.5f + 0.5f * (float) Math.sin(time * 1.1);
		float breathe = wave * wave * (3 - 2 * wave);
		Shapes.glow(g, lx + 3, ly + 3, lx + 16 * big - 3, ly + 16 * big - 3, 8, 12,
				SettingsPanel.alpha(0xCC6D3FD9, in * (0.45f + 0.35f * breathe)));
		if (in > 0.05f) SettingsPanel.logo(g, lx, ly, 16 * big);
		g.push(lx + 16 * big + 8, ly + 16 * big / 2f - 4 * big, big);
		text(g, "NOVEX", 0, 0, TEXT, in, true);
		g.pop();

		int bw = 200, bx = cx - bw / 2, y = top + 24;
		y = button(g, 0, "Singleplayer", Icons.USER, bx, y, bw, mx, my, dt, time, ClientGui.Action.SINGLEPLAYER);
		y = button(g, 1, "Multiplayer", Icons.GLOBE, bx, y, bw, mx, my, dt, time, ClientGui.Action.MULTIPLAYER);
		y = button(g, 2, "Novex Client", Icons.SLIDERS, bx, y, bw, mx, my, dt, time, null);
		y += 8;
		int half = (bw - 4) / 2;
		button(g, 3, "Options", Icons.SETTINGS, bx, y, half, mx, my, dt, time, ClientGui.Action.OPTIONS);
		button(g, 4, "Quit Game", Icons.POWER, bx + bw - half, y, half, mx, my, dt, time, ClientGui.Action.QUIT);

		text(g, "Novex Client", 2, g.height() - 10, MUTED, ease((time - 0.5f) / INTRO), false);
	}

	private int button(Gfx g, int i, String label, int icon, int x, int y0, int w, int mx, int my, float dt, float time, final ClientGui.Action action) {
		// Each button rises into place a moment after the one before.
		float in = ease((time - 0.12f - i * STAGGER) / INTRO);
		int y = y0 + Math.round(12 * (1 - in));
		boolean hot = in > 0.9f && mx >= x && mx < x + w && my >= y && my < y + BUTTON;
		fades[i] += ((hot ? 1f : 0f) - fades[i]) * Math.min(1f, dt * 10f);
		float f = fades[i];
		if (in > 0.01f) {
			Shapes.round(g, x, y, x + w, y + BUTTON, 5, SettingsPanel.alpha(SettingsPanel.mix(CARD, ON, f), in));
			Shapes.outline(g, x, y, x + w, y + BUTTON, 5, 1, SettingsPanel.alpha(SettingsPanel.mix(LINE, 0x66FFFFFF, f), in));
			ripple(g, i, x, y, w);
			int color = SettingsPanel.mix(SOFT, 0xFFFFFFFF, f);
			int tw = g.textWidth(label), iw = Icons.SMALL + 6;
			int left = x + (w - tw - iw) / 2;
			// The icon slides over a little toward the label when hovered.
			boolean drew = in > 0.3f && g.symbol(icon, left + Math.round(2 * f), y + (BUTTON - Icons.SMALL) / 2, false,
					SettingsPanel.alpha(color, in));
			text(g, label, drew ? left + iw : x + (w - tw) / 2, y + (BUTTON - 8) / 2, color, in, false);
		}
		hits.add(new int[] {x, y, w, BUTTON, i});
		actions.add(new Runnable() {
			public void run() {
				if (action == null) owner.homeSettings();
				else owner.act(action);
			}
		});
		return y0 + BUTTON + 6;
	}

	/** A circle that grows from where the button was clicked and fades, kept inside the button. */
	private void ripple(Gfx g, int i, int x, int y, int w) {
		if (rippleButton != i) return;
		float t = (System.nanoTime() - rippleAt) / 1e9f / RIPPLE;
		if (t >= 1f) {
			rippleButton = -1;
			return;
		}
		float r = 4 + w * ease(t);
		g.clip(x, y, x + w, y + BUTTON);
		Shapes.round(g, rippleX - r, rippleY - r, rippleX + r, rippleY + r, r, SettingsPanel.alpha(0x55FFFFFF, 1 - t));
		g.noClip();
	}

	void mouseDown(double mx, double my) {
		if (pending != null) return;
		for (int i = 0; i < hits.size(); i++) {
			int[] r = hits.get(i);
			if (mx >= r[0] && mx < r[0] + r[2] && my >= r[1] && my < r[1] + r[3]) {
				rippleButton = r[4];
				rippleX = (float) mx;
				rippleY = (float) my;
				rippleAt = System.nanoTime();
				// The button acts once the ripple has started to show.
				pending = actions.get(i);
				return;
			}
		}
	}

	/** Text faded in by `in` (0 to 1); skipped while nearly invisible, where Minecraft would draw it opaque. */
	private static void text(Gfx g, String s, int x, int y, int color, float in, boolean spaced) {
		if (in < 0.05f) return;
		int c = SettingsPanel.alpha(color, in);
		if (spaced) SettingsPanel.spaced(g, s, x, y, c, 1, false);
		else g.text(s, x, y, c, false);
	}

	/** Ease-out quint: quick to start, a long soft landing. */
	private static float ease(float t) {
		t = Math.max(0f, Math.min(1f, t));
		float u = 1 - t;
		return 1 - u * u * u * u * u;
	}
}
