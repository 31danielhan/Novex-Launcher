package dev.novex.client.core;

/**
 * Camera stabilize: spreads mouse movement over a few milliseconds, so fast back-and-forth jitter
 * cancels out. The hold grows briefly each time the mouse reverses: a lot for small vibrations, a
 * little for large quick direction changes, and not at all for normal turns. Movement is held back rather than
 * dropped, so the camera still turns the full amount, and a click lets go of whatever is held.
 */
public final class Stabilizer {
	/** How much one reversal adds to the shake level, which runs from 0 to 1. */
	private static final double PER_REVERSAL = 0.5;
	/** How quickly the shake level fades once reversals stop. */
	private static final double SHAKE_SECONDS = 0.06;

	/** How much of the mouse's raw movement becomes degrees of turn. */
	private static final double DEGREES = 0.15;
	/** Degrees per second where a reversal stops counting as a small vibration. */
	private static final double SMALL_SPEED = 60;

	private static double heldYaw, heldPitch, lastYaw, lastPitch, frameYaw, framePitch, speed, shake, release = 1;
	private static long last;
	private static boolean letGo;

	private Stabilizer() {}

	private static boolean off() {
		return !NovexCore.config.cameraStabilize || NovexCore.config.cameraStabilizeStrength == 0;
	}

	/** A click: the next mouse update applies everything held, so the hit lands on the real aim. */
	public static void click() {
		letGo = true;
	}

	/** Called first for each mouse update, since yaw is read before pitch. */
	public static double yaw(double delta) {
		if (off()) {
			heldYaw = heldPitch = lastYaw = lastPitch = frameYaw = framePitch = speed = shake = 0;
			last = 0;
			release = 1;
			letGo = false;
			return delta;
		}
		long now = System.nanoTime();
		double seconds = last == 0 ? 1 : Math.max(1e-4, (now - last) / 1e9);
		last = now;
		double s = NovexCore.config.cameraStabilizeStrength / 100.0;
		shake = seconds > 0.25 ? 0 : shake * Math.exp(-seconds / SHAKE_SECONDS);
		frameYaw = delta;
		double moved = (Math.abs(frameYaw) + Math.abs(framePitch)) * DEGREES / seconds;
		speed = seconds > 0.25 ? 0 : speed + (moved - speed) * (1 - Math.exp(-seconds / 0.04));
		double k = speed / SMALL_SPEED, small = 1 / (1 + k * k);
		// At full strength: 55 ms for normal turns, 80 ms for quick direction changes, 250 ms for vibrations.
		double steady = 0.005 + 0.05 * s, big = 0.02 + 0.06 * s, tiny = 0.05 + 0.2 * s;
		double shaking = big + (tiny - big) * small;
		// Exponential, so the result doesn't depend on the frame rate.
		release = letGo || seconds > 0.25 ? 1 : 1 - Math.exp(-seconds / (steady + (shaking - steady) * shake));
		letGo = false;
		if (delta * lastYaw < 0) shake = Math.min(1, shake + PER_REVERSAL);
		if (delta != 0) lastYaw = delta;
		heldYaw += delta;
		double out = heldYaw * release;
		heldYaw -= out;
		return out;
	}

	public static double pitch(double delta) {
		if (off()) return delta;
		framePitch = delta;
		if (delta * lastPitch < 0) shake = Math.min(1, shake + PER_REVERSAL);
		if (delta != 0) lastPitch = delta;
		heldPitch += delta;
		double out = heldPitch * release;
		heldPitch -= out;
		return out;
	}
}
