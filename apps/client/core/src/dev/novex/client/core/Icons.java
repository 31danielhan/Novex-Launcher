package dev.novex.client.core;

/**
 * Line icons from Lucide (lucide.dev, ISC license), as codepoints in the icon font each version
 * ships (assets/.../font/icons.ttf, cut down to these). Drawn through {@link Gfx#symbol}, so they're
 * rendered at the screen's own resolution and stay sharp at any GUI scale.
 */
public final class Icons {
	public static final int GAUGE = 0xE1BF, MOUSE_CLICK = 0xE124, WIFI = 0xE1AE, COMPASS = 0xE09F,
			KEYBOARD = 0xE284, SHIELD = 0xE15C, FLASK = 0xE0DA, FOOTPRINTS = 0xE3BD, ZOOM_IN = 0xE1B6,
			WIND = 0xE1B0, VIDEO = 0xE1A5, SUN = 0xE17C, CLOUD_SUN = 0xE216, SWORDS = 0xE2B4,
			UTENSILS = 0xE2F6, ARROW_DOWN_TO_LINE = 0xE45A, APPLE = 0xE352, HEART_CRACK = 0xE2D6,
			SCAN_EYE = 0xE53B, PANEL_RIGHT = 0xE436, ARROW_UP_TO_LINE = 0xE460, USER = 0xE19F,
			USERS = 0xE1A4, GLOBE = 0xE0EB, SLIDERS = 0xE29A, SETTINGS = 0xE158, POWER = 0xE144,
			LAYOUT_DASHBOARD = 0xE1C1, BLOCKS = 0xE4FF, LAYOUT_GRID = 0xE105, HOUSE = 0xE0F8, MONITOR = 0xE121;
	/** The Novex logo, the same mark as the launcher's (its src/assets/logo.svg). */
	public static final int LOGO = 0xE900;
	public static final int MUSIC = 0xE126, PLAY = 0xE140, PAUSE = 0xE132, SKIP_FORWARD = 0xE164, SKIP_BACK = 0xE163;

	/** Every icon, for versions that build their glyphs up front. */
	public static final int[] ALL = {GAUGE, MOUSE_CLICK, WIFI, COMPASS, KEYBOARD, SHIELD, FLASK, FOOTPRINTS,
			ZOOM_IN, WIND, VIDEO, SUN, CLOUD_SUN, SWORDS, UTENSILS, ARROW_DOWN_TO_LINE, APPLE, HEART_CRACK, SCAN_EYE,
			PANEL_RIGHT, ARROW_UP_TO_LINE, USER, USERS, GLOBE, SLIDERS, SETTINGS, POWER, LAYOUT_DASHBOARD, BLOCKS,
			LAYOUT_GRID, HOUSE, MONITOR, LOGO, MUSIC, PLAY, PAUSE, SKIP_FORWARD, SKIP_BACK};

	/** Icon box sizes in GUI pixels. */
	public static final int SMALL = 12, BIG = 22;

	private Icons() {}
}
