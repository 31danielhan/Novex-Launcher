package dev.novex.client;

import java.lang.reflect.Method;

/**
 * Screen pixels per window point: 2 on a Retina display when the game renders at full resolution
 * (Argentum Extras' High-DPI Screen), 1 otherwise. Pylon runs the window on SDL 3 and its LWJGL 2
 * stand-in has no way to ask, so this asks SDL directly.
 */
public final class PixelScale {
	private static Method sdlWindow, sdlDensity;
	private static boolean failed;
	/** Asked for many times a frame; the answer only changes when the window moves screens. */
	private static int cached = 1;
	private static long checked;

	private PixelScale() {}

	public static int get() {
		long now = System.nanoTime();
		if (now - checked < 250_000_000L) return cached;
		checked = now;
		return cached = ask();
	}

	private static int ask() {
		if (failed) return 1;
		try {
			if (sdlDensity == null) {
				Class<?> video = Class.forName("org.lwjgl.sdl.SDLVideo");
				sdlWindow = video.getMethod("SDL_GL_GetCurrentWindow");
				sdlDensity = video.getMethod("SDL_GetWindowPixelDensity", long.class);
			}
			long window = (Long) sdlWindow.invoke(null);
			if (window == 0) return 1;
			float density = (Float) sdlDensity.invoke(null, window);
			return density > 0 ? Math.max(1, Math.round(density)) : 1;
		} catch (Throwable t) {
			failed = true;
			return 1;
		}
	}
}
