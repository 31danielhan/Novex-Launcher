package dev.novex.client.core;

import java.util.ArrayDeque;

/** Mouse presses in the last second, for the CPS readout. Only observes input. */
public final class Clicks {
	private static final ArrayDeque<Long> LEFT = new ArrayDeque<Long>();
	private static final ArrayDeque<Long> RIGHT = new ArrayDeque<Long>();

	public static synchronized void press(int button) {
		if (button == 0) LEFT.add(System.currentTimeMillis());
		else if (button == 1) RIGHT.add(System.currentTimeMillis());
	}

	public static synchronized int left() {
		return count(LEFT);
	}

	public static synchronized int right() {
		return count(RIGHT);
	}

	private static int count(ArrayDeque<Long> q) {
		long cutoff = System.currentTimeMillis() - 1000;
		while (!q.isEmpty() && q.peekFirst() < cutoff) q.pollFirst();
		return q.size();
	}
}
