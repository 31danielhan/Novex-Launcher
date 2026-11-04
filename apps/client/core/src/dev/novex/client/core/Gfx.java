package dev.novex.client.core;

/** What the HUD needs from a version's drawing API. Colors are ARGB. */
public interface Gfx {
	int width();

	int height();

	void fill(int x1, int y1, int x2, int y2, int color);

	void text(String s, int x, int y, int color, boolean shadow);

	int textWidth(String s);

	int lineHeight();

	/** Draws an item stack handed out by {@link Game#armor()}. */
	void item(Object stack, int x, int y);

	/** Moves the origin to (x, y) and scales everything drawn until {@link #pop()}. */
	void push(float x, float y, float scale);

	void pop();

	/**
	 * Draws the item with this id ("minecraft:clock") at 16x16. Returns false when it can't: the
	 * version lacks the item, or items aren't ready yet (on newer versions, before a world loads).
	 */
	boolean icon(String itemId, int x, int y);

	/** Clips drawing to a rectangle in screen GUI pixels (not affected by push) until {@link #noClip()}. */
	void clip(int x1, int y1, int x2, int y2);

	void noClip();
}
