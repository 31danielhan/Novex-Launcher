package dev.novex.client.core;

/**
 * Camera motion blur. Each frame the adapter passes the camera's rotation and field of view; this
 * works out how far the view turned and packs it, with the strength and aspect ratio, into the bytes
 * of a small texture. The blur shader reads that texture, finds where each pixel's point sat before
 * this frame's turn, and averages samples along that path. Blur appears only while the view moves,
 * and with no history between frames there are no ghost copies or trails.
 *
 * The texture is {@link #WIDTH}x1 grey pixels; value i is a 16-bit number split over pixels 2i (high
 * byte) and 2i + 1 (low byte), mapped from -1..1. Values: yaw change, pitch change (radians, over
 * {@link #MAX_TURN}), tan(vertical FOV / 2) over 4, aspect ratio over 4, strength over 2.
 */
public final class MotionBlur {
	public static final int WIDTH = 10;
	private static final float MAX_TURN = 0.6f;
	/** Blur as if the shutter were open for one 60 Hz frame, whatever the frame rate. */
	private static final float SHUTTER = 1f / 60f;
	private static final float[] STRENGTH = {0.6f, 0.9f, 1.25f};

	private static float lastYaw = Float.NaN, lastPitch;
	private static long lastNanos;

	/** Grey levels (0-255) for the texture's pixels this frame. Angles in degrees, as the game stores them. */
	public static int[] frame(float yawDeg, float pitchDeg, float fovDeg, float aspect) {
		long now = System.nanoTime();
		float dt = lastNanos == 0 ? SHUTTER : (now - lastNanos) / 1e9f;
		lastNanos = now;
		float dyaw = 0, dpitch = 0;
		// After a gap (blur was off, the game was paused) there's no motion to show yet.
		if (!Float.isNaN(lastYaw) && dt < 0.25f) {
			dyaw = wrapDegrees(yawDeg - lastYaw);
			dpitch = pitchDeg - lastPitch;
		}
		lastYaw = yawDeg;
		lastPitch = pitchDeg;

		// Turn per second, over a 60 Hz shutter. Huge jumps (teleports, respawns) aren't motion.
		float scale = SHUTTER / Math.max(1e-4f, Math.min(0.25f, dt));
		float yaw = (float) Math.toRadians(dyaw) * scale, pitch = (float) Math.toRadians(dpitch) * scale;
		if (Math.abs(dyaw) > 90 || Math.abs(dpitch) > 90) yaw = pitch = 0;

		float fov = NovexCore.zooming ? fovDeg / NovexCore.config.zoomFactor : fovDeg;
		float tanHalf = (float) Math.tan(Math.toRadians(fov) / 2);
		float strength = STRENGTH[Math.max(0, Math.min(2, NovexCore.config.motionBlurLevel - 1))];

		int[] px = new int[WIDTH];
		put(px, 0, yaw / MAX_TURN);
		put(px, 1, pitch / MAX_TURN);
		put(px, 2, tanHalf / 2f - 1f);
		put(px, 3, aspect / 2f - 1f);
		put(px, 4, strength - 1f);
		return px;
	}

	/** A grey ARGB pixel. Grey keeps it the same in ARGB and ABGR, which versions disagree on. */
	public static int grey(int v) {
		return 0xFF000000 | v << 16 | v << 8 | v;
	}

	private static void put(int[] px, int i, float v) {
		int u = Math.round((Math.max(-1f, Math.min(1f, v)) * 0.5f + 0.5f) * 65535f);
		px[2 * i] = u >> 8;
		px[2 * i + 1] = u & 0xFF;
	}

	private static float wrapDegrees(float d) {
		d %= 360f;
		if (d >= 180f) d -= 360f;
		if (d < -180f) d += 360f;
		return d;
	}
}
