package dev.novex.client.core;

/** Switchable modules, in menu order. Keys match the fields in Config and the launcher's Client page. */
public enum Module {
	FPS("fps", "FPS", Category.HUD, "Frames per second.", "minecraft:clock"),
	CPS("cps", "CPS", Category.HUD, "Left and right clicks per second.", "minecraft:arrow"),
	PING("ping", "Ping", Category.HUD, "Latency to the server. Hidden in singleplayer.", "minecraft:redstone_torch"),
	COORDINATES("coordinates", "Coordinates", Category.HUD, "Position and facing direction.", "minecraft:compass"),
	KEYSTROKES("keystrokes", "Keystrokes", Category.HUD, "WASD, mouse buttons and jump.", "minecraft:repeater"),
	ARMOR("armor", "Armor status", Category.HUD, "Durability of your armor and held item.", "minecraft:iron_chestplate"),
	EFFECTS("effects", "Potion effects", Category.HUD, "Active effects and time left.", "minecraft:potion"),
	TOGGLE_SPRINT("toggleSprint", "Toggle sprint", Category.GAMEPLAY, "Press sprint once to keep sprinting.", "minecraft:sugar"),
	ZOOM("zoom", "Zoom", Category.GAMEPLAY, "Hold C to zoom in.", "minecraft:ender_eye"),
	MOTION_BLUR("motionBlur", "Motion blur", Category.VISUAL, "Movement leaves a short trail.", "minecraft:ender_pearl"),
	BLOCK_HIT("oldBlockHit", "1.7 block hit", Category.VISUAL, "Swing while blocking, like 1.7.", "minecraft:diamond_sword"),
	OLD_EATING("oldEating", "1.7 eating", Category.VISUAL, "Eating and drinking swing like 1.7.", "minecraft:cooked_beef"),
	DAMAGE_TILT("damageTilt", "Damage tilt", Category.VISUAL, "Camera tilts when you take damage.", "minecraft:redstone"),
	FOV_EFFECTS("fovEffects", "FOV effects", Category.VISUAL, "Sprinting, flying and bows change your FOV.", "minecraft:bow"),
	SIDEBAR("sidebar", "Sidebar", Category.HUD, "Cleaner scoreboard sidebar.", "minecraft:paper"),
	BUILD_LIMIT("buildLimit", "Build height limit", Category.HUD, "Warns near the build height limit.", "minecraft:ladder");

	public enum Category {
		HUD("HUD"),
		VISUAL("Visual"),
		GAMEPLAY("Gameplay");

		public final String label;

		Category(String label) {
			this.label = label;
		}
	}

	/** Modules every version supports. Adapters that do more add to this in NovexCore.modules. */
	public static final Module[] BASE = {FPS, CPS, PING, COORDINATES, KEYSTROKES, ARMOR, EFFECTS, TOGGLE_SPRINT, ZOOM};
	/** BASE plus motion blur, for versions with a motion blur shader. */
	public static final Module[] WITH_BLUR = {FPS, CPS, PING, COORDINATES, KEYSTROKES, ARMOR, EFFECTS, TOGGLE_SPRINT, ZOOM, MOTION_BLUR};

	public final String key;
	public final String label;
	public final Category category;
	public final String description;
	/** Item shown on the module's card; picked from items that exist in every version from 1.8.9 on. */
	public final String icon;

	Module(String key, String label, Category category, String description, String icon) {
		this.key = key;
		this.label = label;
		this.category = category;
		this.description = description;
		this.icon = icon;
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
			case BLOCK_HIT: return c.oldBlockHit;
			case OLD_EATING: return c.oldEating;
			case DAMAGE_TILT: return c.damageTilt;
			case FOV_EFFECTS: return c.fovEffects;
			case SIDEBAR: return c.sidebar;
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
			case BLOCK_HIT: c.oldBlockHit = v; break;
			case OLD_EATING: c.oldEating = v; break;
			case DAMAGE_TILT: c.damageTilt = v; break;
			case FOV_EFFECTS: c.fovEffects = v; break;
			case SIDEBAR: c.sidebar = v; break;
			default: c.buildLimit = v;
		}
	}

	/** Menu button text, e.g. "FPS: ON". */
	public String label(Config c) {
		return label + ": " + (get(c) ? "ON" : "OFF");
	}
}
