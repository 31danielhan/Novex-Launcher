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
 * {@link #MAX_TURN}), tan(vertical FOV / 2) over 4, aspect ratio over 4, walking blur, how much of the
 * previous frame to keep, how much more to keep around the hand during a swing. That last one is what blurs things the camera turn can't describe, like the
 * hand swinging; Fabric 1.21.4 and 1.21.5 can't keep a frame between renders, so they ignore it.
 */
public final class MotionBlur {
	public static final int WIDTH = 14;
	private static final float MAX_TURN = 0.6f;
	/** Blur as if the shutter were open for one 60 Hz frame, whatever the frame rate. */
	private static final float SHUTTER = 1f / 60f;

	private static final float EASE_SECONDS = 0.03f;
	/** Slower easing as the turn slows, so the blur fades out when the camera stops. */
	private static final float FADE_SECONDS = 0.12f;
	/** Blocks per second that count as full walking blur. */
	private static final float WALK_SPEED = 8f;

	private static float lastYaw = Float.NaN, lastPitch;
	private static float smoothYaw, smoothPitch;
	private static long lastNanos;
	private static double lastX = Double.NaN, lastY, lastZ;
	private static long lastMoved;
	private static float walk, walkTarget, swing;
	private static final int[] pixels = new int[WIDTH], sent = new int[WIDTH];

	/**
	 * Grey levels (0-255) for the texture's pixels this frame, or null if they haven't changed and
	 * there's nothing to upload. Angles in degrees, as the game stores them.
	 */
	public static int[] frame(float yawDeg, float pitchDeg, float fovDeg, float aspect, double x, double y, double z, boolean swinging) {
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

		// Eases the turn between frames, so uneven mouse input and frame times don't make the blur flicker.
		if (dt >= 0.25f || Math.abs(dyaw) > 90 || Math.abs(dpitch) > 90) smoothYaw = smoothPitch = 0;
		smoothYaw = ease(smoothYaw, yaw, dt);
		smoothPitch = ease(smoothPitch, pitch, dt);
		yaw = smoothYaw;
		pitch = smoothPitch;

		float fov = NovexCore.zooming ? fovDeg / NovexCore.config.zoomFactor : fovDeg;
		float tanHalf = (float) Math.tan(Math.toRadians(fov) / 2);
		float amount = NovexCore.config.motionBlurStrength / 100f;
		float gain = 0.05f + 1.9f * amount;

		// Position only changes 20 times a second, so speed is measured from one change to the next.
		if (Double.isNaN(lastX)) lastMoved = now;
		else if (x != lastX || y != lastY || z != lastZ) {
			float seconds = Math.max(0.01f, (now - lastMoved) / 1e9f);
			double rad = Math.toRadians(yawDeg), up = Math.toRadians(pitchDeg);
			double forward = ((x - lastX) * -Math.sin(rad) + (z - lastZ) * Math.cos(rad)) * Math.cos(up) - (y - lastY) * Math.sin(up);
			float speed = (float) Math.abs(forward) / seconds;
			// Teleports aren't walking.
			walkTarget = speed > 40f ? 0f : Math.min(1f, speed / WALK_SPEED * gain);
			lastMoved = now;
		} else if (now - lastMoved > 150_000_000L) walkTarget = 0f;
		// Eased every frame, so the 20-a-second position updates don't show as steps in the blur.
		walk += (walkTarget - walk) * (1f - (float) Math.exp(-Math.max(0f, dt) / 0.1f));
		lastX = x;
		lastY = y;
		lastZ = z;

		// Keeps some of the previous frame, the same amount per second at any frame rate.
		float keep = dt >= 0.25f || Math.abs(dyaw) > 90 || Math.abs(dpitch) > 90
				? 0f : Math.min(0.85f, (float) Math.exp(-Math.max(0f, dt) / (0.002f + 0.034f * amount)));

		// Eased, so the extra blur doesn't cut off between swings. Same trail length at any frame rate.
		float swingTarget = swinging && keep > 0f ? Math.min(0.85f, (float) Math.exp(-Math.max(0f, dt) / (0.008f + 0.042f * amount))) : 0f;
		swing = ease(swing, swingTarget, dt);

		put(pixels, 0, yaw * gain / MAX_TURN);
		put(pixels, 1, pitch * gain / MAX_TURN);
		put(pixels, 2, tanHalf / 2f - 1f);
		put(pixels, 3, aspect / 2f - 1f);
		put(pixels, 4, walk * 2f - 1f);
		put(pixels, 5, keep * 2f - 1f);
		put(pixels, 6, swing * 2f - 1f);
		if (java.util.Arrays.equals(pixels, sent)) return null;
		System.arraycopy(pixels, 0, sent, 0, WIDTH);
		return pixels;
	}

	private static float ease(float from, float to, float dt) {
		float time = Math.abs(to) < Math.abs(from) ? FADE_SECONDS : EASE_SECONDS;
		return from + (to - from) * (1f - (float) Math.exp(-Math.max(0f, dt) / time));
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
