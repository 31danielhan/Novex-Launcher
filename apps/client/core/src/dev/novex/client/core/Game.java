package dev.novex.client.core;

import java.util.List;

/** What the HUD reads from the game. Each version's adapter implements it. */
public interface Game {
	enum Key { UP, LEFT, DOWN, RIGHT, JUMP, ATTACK, USE }

	final class Piece {
		public final Object stack;
		public final String text;
		public final boolean low;

		public Piece(Object stack, String text, boolean low) {
			this.stack = stack;
			this.text = text;
			this.low = low;
		}
	}

	final class Effect {
		public final String name;
		public final int amplifier;
		public final int ticks;
		public final boolean infinite;

		public Effect(String name, int amplifier, int ticks, boolean infinite) {
			this.name = name;
			this.amplifier = amplifier;
			this.ticks = ticks;
			this.infinite = infinite;
		}
	}

	/** False before a world is loaded, or while the debug screen covers the HUD. */
	boolean active();

	int fps();

	/** Latency to the server in ms, or -1 in singleplayer. */
	int ping();

	double x();

	double y();

	double z();

	String facing();

	boolean down(Key key);

	/** Helmet to boots, then the held item; empty slots left out. */
	List<Piece> armor();

	List<Effect> effects();

	/** Blocks above the player's feet left before the build height limit, or -1 where the version doesn't track it. */
	int blocksToBuildLimit();
}
