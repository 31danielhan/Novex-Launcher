package dev.novex.client.core;

/**
 * Camera stabilize: spreads mouse movement over a few milliseconds, so fast back-and-forth jitter
 * cancels out. It compares where the mouse actually got to with how much it moved: movement that
 * goes somewhere is deliberate and barely held, while movement that goes nowhere is vibration and
 * held longer, most of all when it's small. Movement is held back rather than dropped, so the camera
 * still turns the full amount.
 *
 * {@link #yaw} and {@link #pitch} change the player's real rotation, which anti-cheats can flag, so
 * adapters only call them in singleplayer. On servers they call {@link #viewYaw} and {@link #viewPitch}
 * instead, which steady only what's drawn and stay within a small angle of the real aim.
 */
public final class Stabilizer {
	/** How far back movement is compared, so one sensor flip mid-turn can't look like shaking. */
	private static final double WINDOW_SECONDS = 0.08;
	/** How much of the mouse's raw movement becomes degrees of turn. */
	private static final double DEGREES = 0.15;
	/** Degrees per second where shaking stops counting as a small vibration. */
	private static final double SMALL_SPEED = 60;

	private static double heldYaw, heldPitch, netYaw, netPitch, movedYaw, movedPitch, release = 1, blend, perSecond;
	private static long last;

	private Stabilizer() {}

	/** The slider as a multiplier: close to its value at low settings, rising to 1.6 at 100. */
	private static double power() {
		double s = NovexCore.config.cameraStabilizeStrength / 100.0;
		return s + 0.6 * s * s * s;
	}

	private static boolean off() {
		return !NovexCore.config.cameraStabilize || NovexCore.config.cameraStabilizeStrength == 0;
	}

	/** Called first for each mouse update, since yaw is read before pitch. */
	public static double yaw(double delta) {
		if (off()) {
			heldYaw = heldPitch = netYaw = netPitch = movedYaw = movedPitch = 0;
			last = 0;
			release = 1;
			return delta;
		}
		long now = System.nanoTime();
		double seconds = last == 0 ? 1 : Math.max(1e-4, (now - last) / 1e9);
		last = now;
		if (seconds > 0.25) {
			netYaw = netPitch = movedYaw = movedPitch = 0;
			blend = 1;
			release = 1;
		} else {
			perSecond = 1 / seconds;
			blend = 1 - Math.exp(-seconds / WINDOW_SECONDS);
			netYaw += (delta * perSecond - netYaw) * blend;
			movedYaw += (Math.abs(delta) * perSecond - movedYaw) * blend;
			double moved = movedYaw + movedPitch, net = Math.sqrt(netYaw * netYaw + netPitch * netPitch);
			// 0 until at least half the movement cancels itself out, so a noisy turn stays free; 1 for pure shaking.
			double shake = moved > 0 ? Math.max(0, 1 - 2 * net / moved) : 0;
			shake *= shake;
			double k = moved * DEGREES / SMALL_SPEED, small = 1 / (1 + k * k);
			double s = power();
			// At full strength: 88 ms for normal turns, 174 ms for quick direction changes, 400 ms for vibrations.
			double steady = 0.008 + 0.05 * s, big = 0.03 + 0.09 * s, tiny = 0.08 + 0.2 * s;
			double shaking = big + (tiny - big) * small;
			// Exponential, so the result doesn't depend on the frame rate.
			release = 1 - Math.exp(-seconds / (steady + (shaking - steady) * shake));
		}
		heldYaw += delta;
		double out = heldYaw * release;
		heldYaw -= out;
		return out;
	}

	public static double pitch(double delta) {
		if (off()) return delta;
		if (release < 1 && last != 0) {
			netPitch += (delta * perSecond - netPitch) * blend;
			movedPitch += (Math.abs(delta) * perSecond - movedPitch) * blend;
		}
		heldPitch += delta;
		double out = heldPitch * release;
		heldPitch -= out;
		return out;
	}

	// ---- View only, for servers ----------------------------------------------------------------

	/** A turn this large in one frame is a teleport or respawn, not shaking. */
	private static final float JUMP_DEGREES = 45;

	private static float shownYaw, shownPitch, realYaw = Float.NaN, realPitch;
	private static double viewNetYaw, viewNetPitch, viewMovedYaw, viewMovedPitch, viewBlend, viewSeconds, viewRelease = 1;
	private static long viewLast;

	/** The drawn yaw for this frame. Called before {@link #viewPitch}. */
	public static float viewYaw(float yaw) {
		if (off()) {
			realYaw = Float.NaN;
			return yaw;
		}
		long now = System.nanoTime();
		double seconds = viewLast == 0 ? 1 : Math.max(1e-4, (now - viewLast) / 1e9);
		viewLast = now;
		float turn = yaw - realYaw;
		if (Float.isNaN(realYaw) || seconds > 0.25 || Math.abs(turn) > JUMP_DEGREES) {
			viewNetYaw = viewNetPitch = viewMovedYaw = viewMovedPitch = 0;
			viewRelease = 1;
			shownYaw = realYaw = yaw;
			return yaw;
		}
		realYaw = yaw;
		viewSeconds = seconds;
		viewBlend = 1 - Math.exp(-seconds / WINDOW_SECONDS);
		viewNetYaw += (turn / seconds - viewNetYaw) * viewBlend;
		viewMovedYaw += (Math.abs(turn) / seconds - viewMovedYaw) * viewBlend;
		double moved = viewMovedYaw + viewMovedPitch, net = Math.sqrt(viewNetYaw * viewNetYaw + viewNetPitch * viewNetPitch);
		double shake = moved > 0 ? Math.max(0, 1 - 2 * net / moved) : 0;
		double s = power();
		shake *= shake;
		// The same holds as the singleplayer filter, so turns ease to a stop the same way.
		double k = moved / SMALL_SPEED, small = 1 / (1 + k * k);
		double steady = 0.008 + 0.05 * s, big = 0.03 + 0.09 * s, tiny = 0.08 + 0.2 * s;
		double hold = steady + (big + (tiny - big) * small - steady) * shake;
		viewRelease = 1 - Math.exp(-seconds / hold);
		shownYaw = limit(shownYaw + (float) ((yaw - shownYaw) * viewRelease), yaw);
		return shownYaw;
	}

	public static float viewPitch(float pitch) {
		if (off() || Float.isNaN(realYaw)) return pitch;
		float turn = pitch - realPitch;
		realPitch = pitch;
		if (viewRelease >= 1 || Math.abs(turn) > JUMP_DEGREES) return shownPitch = pitch;
		viewNetPitch += (turn / viewSeconds - viewNetPitch) * viewBlend;
		viewMovedPitch += (Math.abs(turn) / viewSeconds - viewMovedPitch) * viewBlend;
		shownPitch = limit(shownPitch + (float) ((pitch - shownPitch) * viewRelease), pitch);
		return shownPitch;
	}

	/** Keeps the view within a small angle of the real aim: never more than about 32 degrees. */
	private static float limit(float shown, float real) {
		float gap = 0.15f + 19.85f * (float) power();
		return Math.max(real - gap, Math.min(real + gap, shown));
	}
}
