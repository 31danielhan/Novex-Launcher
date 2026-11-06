package dev.novex.client.core;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

/** Settings in config/novex-client.json. Novex Launcher writes the same file to switch modules per instance. */
public final class Config {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private transient Path file;

	/** Where each HUD element sits, by element id; missing ones use their default spot. */
	public Map<String, Layout> hud = new HashMap<String, Layout>();

	/** A Novex Client button on the title screen. */
	public boolean titleButton = true;

	/** Size set in the launcher, by element id: replaces the scale in `hud` when the game starts. */
	public Map<String, Float> hudSize = new HashMap<String, Float>();
	/** Dark plates behind HUD text and keys. */
	public boolean hudPlates = true;
	/** Plate opacity, 0 to 100. */
	public int hudPlateOpacity = 40;
	public boolean hudShadow = false;
	/** HUD text color, as 0xRRGGBB. */
	public int hudTextColor = 0xF2F4F5;
	/** Decimal places on coordinates, 0 to 2. */
	public int coordinatesDecimals = 0;
	public boolean coordinatesFacing = true;
	public boolean keystrokesMouse = true;
	public boolean keystrokesJump = true;

	public boolean fps = true;
	public boolean cps = true;
	public boolean ping = true;
	public boolean coordinates = true;
	public boolean keystrokes = true;
	public boolean armor = true;
	public boolean effects = true;
	public boolean toggleSprint = false;
	public boolean zoom = true;
	/** Field of view is divided by this while zooming. */
	public float zoomFactor = 4f;

	public boolean motionBlur = false;
	/** 0 to 100. */
	public int motionBlurStrength = 50;

	public boolean cameraStabilize = false;
	/** 0 to 100. */
	public int cameraStabilizeStrength = 50;

	// 1.8.9 only.
	public boolean oldBlockHit = true;
	public boolean oldEating = true;
	/** Off removes the camera tilt when you take damage. */
	public boolean damageTilt = true;
	/** Off keeps the field of view still when sprinting, flying or using a bow. */
	public boolean fovEffects = true;
	public boolean sidebar = true;
	/** Red score numbers on the sidebar; off by default, as most servers use them only for ordering. */
	public boolean sidebarNumbers = false;
	public boolean buildLimit = true;
	/** Highest Y you can place a block at. 1.8.9 worlds stop at 255; servers such as Hypixel set lower limits per map. */
	public int buildHeight = 255;

	public static Config load(Path file) {
		Config c = null;
		try {
			if (Files.exists(file)) c = GSON.fromJson(new String(Files.readAllBytes(file), StandardCharsets.UTF_8), Config.class);
		} catch (Exception e) {
			NovexCore.log("Couldn't read " + file + ", using defaults: " + e);
		}
		if (c == null) c = new Config();
		if (c.zoomFactor < 1f) c.zoomFactor = 4f;
		if (c.hud == null) c.hud = new HashMap<String, Layout>();
		c.motionBlurStrength = Math.max(0, Math.min(100, c.motionBlurStrength));
		c.cameraStabilizeStrength = Math.max(0, Math.min(100, c.cameraStabilizeStrength));
		if (c.hudSize == null) c.hudSize = new HashMap<String, Float>();
		c.hudPlateOpacity = Math.max(0, Math.min(100, c.hudPlateOpacity));
		c.coordinatesDecimals = Math.max(0, Math.min(2, c.coordinatesDecimals));
		for (Map.Entry<String, Float> e : c.hudSize.entrySet()) {
			Layout l = c.hud.get(e.getKey());
			if (l != null) l.scale = e.getValue();
		}
		c.file = file;
		c.save();
		return c;
	}

	public void save() {
		try {
			Files.createDirectories(file.getParent());
			Files.write(file, GSON.toJson(this).getBytes(StandardCharsets.UTF_8));
		} catch (IOException e) {
			NovexCore.log("Couldn't save " + file + ": " + e);
		}
	}
}
