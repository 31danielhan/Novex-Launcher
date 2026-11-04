package dev.novex.client.core;

/** A HUD element's spot: top-left corner as a fraction of the screen, so it survives resizing. */
public final class Layout {
	public float x;
	public float y;
	public float scale = 1f;

	public Layout() {}

	public Layout(float x, float y, float scale) {
		this.x = x;
		this.y = y;
		this.scale = scale;
	}
}
