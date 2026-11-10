package dev.novex.client.core;

import java.nio.file.Path;

/** State shared by every adapter. */
public final class NovexCore {
	public static final String ID = "novex-client";
	public static Config config;
	/** Modules this version supports, in menu order. */
	public static Module[] modules = Module.BASE;
	/** True while the HUD editor or settings are open; the editor draws the HUD itself then. */
	public static boolean editing;
	/** True while the menu draws, so its text uses the smooth font instead of Minecraft's pixel one. */
	public static boolean uiFont;
	/** Set by the adapter each tick while the zoom key is held. */
	public static boolean zooming;

	public static void init(Path configDir) {
		config = Config.load(configDir.resolve("novex-client.json"));
		OfflineSkin.init(configDir);
	}

	/** Set by the adapter to push settings into the game (toggle sprint) after they change. */
	public static Runnable onChange;

	static void changed() {
		if (onChange != null) onChange.run();
	}

	public static float zoomedFov(float fov) {
		return zooming ? fov / config.zoomFactor : fov;
	}

	static void log(String s) {
		System.out.println("[Novex Client] " + s);
	}
}
