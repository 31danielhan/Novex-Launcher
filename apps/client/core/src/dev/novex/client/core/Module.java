package dev.novex.client.core;

/** Switchable modules, in menu order. Keys match the fields in Config and the launcher's Client page. */
public enum Module {
	FPS("fps", "FPS", Category.HUD, "Frames per second.", "minecraft:clock", Icons.GAUGE),
	CPS("cps", "CPS", Category.HUD, "Left and right clicks per second.", "minecraft:arrow", Icons.MOUSE_CLICK),
	PING("ping", "Ping", Category.HUD, "Latency to the server. Hidden in singleplayer.", "minecraft:redstone_torch", Icons.WIFI),
	COORDINATES("coordinates", "Coordinates", Category.HUD, "Position and facing direction.", "minecraft:compass", Icons.COMPASS),
	KEYSTROKES("keystrokes", "Keystrokes", Category.HUD, "WASD, mouse buttons and jump.", "minecraft:repeater", Icons.KEYBOARD),
	ARMOR("armor", "Armor status", Category.HUD, "Durability of your armor and held item.", "minecraft:iron_chestplate", Icons.SHIELD),
	EFFECTS("effects", "Potion effects", Category.HUD, "Active effects and time left.", "minecraft:potion", Icons.FLASK),
	TOGGLE_SPRINT("toggleSprint", "Toggle sprint", Category.GAMEPLAY, "Press sprint once to keep sprinting.", "minecraft:sugar", Icons.FOOTPRINTS),
	ZOOM("zoom", "Zoom", Category.GAMEPLAY, "Hold C to zoom in.", "minecraft:ender_eye", Icons.ZOOM_IN),
	MOTION_BLUR("motionBlur", "Motion blur", Category.VISUAL, "Movement leaves a short trail.", "minecraft:ender_pearl", Icons.WIND),
	CAMERA_STABILIZE("cameraStabilize", "Camera stabilize", Category.VISUAL, "Smooths shaky mouse movement. View only on servers.", "minecraft:feather", Icons.VIDEO),
	FULLBRIGHT("fullbright", "Fullbright", Category.VISUAL, "See clearly in the dark.", "minecraft:torch", Icons.SUN),
	CUSTOM_SKY("customSky", "Custom sky", Category.VISUAL, "Shows skies from resource packs.", "minecraft:glass", Icons.CLOUD_SUN),
	BLOCK_HIT("oldBlockHit", "1.7 block hit", Category.VISUAL, "Swing while blocking, like 1.7.", "minecraft:diamond_sword", Icons.SWORDS),
	OLD_EATING("oldEating", "1.7 eating", Category.VISUAL, "Eating and drinking swing like 1.7.", "minecraft:cooked_beef", Icons.UTENSILS),
	SMOOTH_SNEAK("smoothSneak", "Smooth sneak", Category.VISUAL, "The camera glides lower when you sneak.", "minecraft:leather_boots", Icons.ARROW_DOWN_TO_LINE),
	SMOOTH_EATING("smoothEating", "Eating animation", Category.VISUAL, "Smooth bobbing, or a ripping swing while eating and drinking.", "minecraft:apple", Icons.APPLE),
	DAMAGE_TILT("damageTilt", "Damage tilt", Category.VISUAL, "Camera tilts when you take damage.", "minecraft:redstone", Icons.HEART_CRACK),
	FOV_EFFECTS("fovEffects", "FOV effects", Category.VISUAL, "Sprinting, flying and bows change your FOV.", "minecraft:bow", Icons.SCAN_EYE),
	SIDEBAR("sidebar", "Sidebar", Category.HUD, "Cleaner scoreboard sidebar.", "minecraft:paper", Icons.PANEL_RIGHT),
	MUSIC("music", "Now playing", Category.HUD, "Music or videos playing on your computer, with play, pause and skip. macOS.", "minecraft:jukebox", Icons.MUSIC),
	BUILD_LIMIT("buildLimit", "Build height limit", Category.HUD, "Warns near the build height limit.", "minecraft:ladder", Icons.ARROW_UP_TO_LINE);

	public enum Category {
		HUD("HUD"),
		VISUAL("Visual"),
		GAMEPLAY("Gameplay");

		public final String label;

		Category(String label) {
			this.label = label;
		}

		/** The label in the game's language. */
		public String title() {
			return Lang.tr(label);
		}
	}

	/** Modules every version supports. Adapters that do more add to this in NovexCore.modules. */
	public static final Module[] BASE = {FPS, CPS, PING, COORDINATES, KEYSTROKES, ARMOR, EFFECTS, TOGGLE_SPRINT, ZOOM, CAMERA_STABILIZE, FULLBRIGHT, MUSIC};
	/** BASE plus motion blur, for versions with a motion blur shader. */
	public static final Module[] WITH_BLUR = {FPS, CPS, PING, COORDINATES, KEYSTROKES, ARMOR, EFFECTS, TOGGLE_SPRINT, ZOOM, MOTION_BLUR, CAMERA_STABILIZE, FULLBRIGHT};

	public final String key;
	public final String label;
	public final Category category;
	public final String description;
	/** Item shown on the module's card; picked from items that exist in every version from 1.8.9 on. */
	public final String icon;
	/** Line icon ({@link Icons}), drawn instead of the item where the version can. */
	public final int glyph;

	Module(String key, String label, Category category, String description, String icon, int glyph) {
		this.key = key;
		this.label = label;
		this.category = category;
		this.description = description;
		this.icon = icon;
		this.glyph = glyph;
	}

	/** The label in the game's language. */
	public String title() {
		return Lang.tr(label);
	}

	/** The description in the game's language. */
	public String about() {
		return Lang.tr(description);
	}

	public boolean get(Config c) {
		switch (this) {
			case FPS: return c.fps;
			case CPS: return c.cps;
			case PING: return c.ping;
			case COORDINATES: return c.coordinates;
			case KEYSTROKES: return c.keystrokes;
			case ARMOR: return c.armor;
			case EFFECTS: return c.effects;
			case TOGGLE_SPRINT: return c.toggleSprint;
			case ZOOM: return c.zoom;
			case MOTION_BLUR: return c.motionBlur;
			case CAMERA_STABILIZE: return c.cameraStabilize;
			case FULLBRIGHT: return c.fullbright;
			case CUSTOM_SKY: return c.customSky;
			case BLOCK_HIT: return c.oldBlockHit;
			case OLD_EATING: return c.oldEating;
			case SMOOTH_SNEAK: return c.smoothSneak;
			case SMOOTH_EATING: return c.smoothEating;
			case DAMAGE_TILT: return c.damageTilt;
			case FOV_EFFECTS: return c.fovEffects;
			case SIDEBAR: return c.sidebar;
			case MUSIC: return c.music;
			default: return c.buildLimit;
		}
	}

	public void set(Config c, boolean v) {
		switch (this) {
			case FPS: c.fps = v; break;
			case CPS: c.cps = v; break;
			case PING: c.ping = v; break;
			case COORDINATES: c.coordinates = v; break;
			case KEYSTROKES: c.keystrokes = v; break;
			case ARMOR: c.armor = v; break;
			case EFFECTS: c.effects = v; break;
			case TOGGLE_SPRINT: c.toggleSprint = v; break;
			case ZOOM: c.zoom = v; break;
			case MOTION_BLUR: c.motionBlur = v; break;
			case CAMERA_STABILIZE: c.cameraStabilize = v; break;
			case FULLBRIGHT: c.fullbright = v; break;
			case CUSTOM_SKY: c.customSky = v; break;
			case BLOCK_HIT: c.oldBlockHit = v; break;
			case OLD_EATING: c.oldEating = v; break;
			case SMOOTH_SNEAK: c.smoothSneak = v; break;
			case SMOOTH_EATING: c.smoothEating = v; break;
			case DAMAGE_TILT: c.damageTilt = v; break;
			case FOV_EFFECTS: c.fovEffects = v; break;
			case SIDEBAR: c.sidebar = v; break;
			case MUSIC: c.music = v; break;
			default: c.buildLimit = v;
		}
	}

	/** Menu button text, e.g. "FPS: ON". */
	public String label(Config c) {
		return label + ": " + (get(c) ? "ON" : "OFF");
	}
}
