package dev.novex.client;

import dev.novex.client.core.Icons;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import net.minecraft.client.renderer.GlStateManager;
import net.minecraft.client.renderer.Tessellator;
import net.minecraft.client.renderer.WorldRenderer;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.client.renderer.vertex.DefaultVertexFormats;
import org.lwjgl.opengl.GL11;

/**
 * TrueType text on 1.8.9, which can't load TrueType fonts itself: the menu's Poppins and the line
 * icons. Glyphs are drawn with anti-aliasing into a texture at the screen's own resolution (one
 * texel per screen pixel), then drawn back scaled down by the GUI scale, so they stay sharp and smooth
 * at any GUI scale.
 */
final class SmoothFont {
	private static final int PAD = 2;

	/** The menu's text: Poppins, sized to sit like Minecraft's 9-pixel line. */
	static final SmoothFont UI = new SmoothFont("poppins.ttf", 8.5f, 7.5f, range(32, 255));
	/** Line icons filling a box the font's size square ({@link Icons#SMALL} and {@link Icons#BIG}). */
	static final SmoothFont ICONS = new SmoothFont("icons.ttf", Icons.SMALL, Icons.SMALL, Icons.ALL);
	static final SmoothFont BIG_ICONS = new SmoothFont("icons.ttf", Icons.BIG, Icons.BIG, Icons.ALL);

	private final String file;
	/** Font size, and where the baseline sits below the top of a line, in GUI pixels. */
	private final float size, baseline;
	private final int[] codepoints;
	private final Map<Integer, Integer> index = new HashMap<Integer, Integer>();

	private Font base;
	private boolean failed;
	private DynamicTexture texture;
	private int scale, texW, texH, cellH, ascent;
	private final int[] u, v, w;
	private final float[] advance;

	private SmoothFont(String file, float size, float baseline, int[] codepoints) {
		this.file = file;
		this.size = size;
		this.baseline = baseline;
		this.codepoints = codepoints;
		for (int i = 0; i < codepoints.length; i++) index.put(codepoints[i], i);
		u = new int[codepoints.length];
		v = new int[codepoints.length];
		w = new int[codepoints.length];
		advance = new float[codepoints.length];
	}

	private static int[] range(int first, int last) {
		int[] r = new int[last - first + 1];
		for (int i = 0; i < r.length; i++) r[i] = first + i;
		return r;
	}

	/** Whether this text can be drawn with this font at this GUI scale. */
	boolean can(String s, int guiScale) {
		if (!ready(guiScale)) return false;
		for (int i = 0; i < s.length(); i++) {
			char c = s.charAt(i);
			if (c != '§' && !index.containsKey((int) c)) return false;
		}
		return true;
	}

	int width(String s) {
		float x = 0;
		for (int i = 0; i < s.length(); i++) {
			char c = s.charAt(i);
			if (c == '§') {
				i++;
				continue;
			}
			Integer g = index.get((int) c);
			if (g != null) x += advance[g];
		}
		return (int) Math.ceil(x / scale);
	}

	void draw(String s, float x, float y, int color) {
		// Like Minecraft's font: a color with no alpha is drawn opaque.
		if ((color & 0xFC000000) == 0) color |= 0xFF000000;
		float a = (color >>> 24 & 0xFF) / 255f, r = (color >> 16 & 0xFF) / 255f, gr = (color >> 8 & 0xFF) / 255f, b = (color & 0xFF) / 255f;
		GlStateManager.enableBlend();
		GlStateManager.tryBlendFuncSeparate(770, 771, 1, 0);
		GlStateManager.enableTexture2D();
		GlStateManager.bindTexture(texture.getGlTextureId());
		GlStateManager.color(r, gr, b, a);
		GlStateManager.pushMatrix();
		// The baseline sits where it centres capitals in Minecraft's 9-pixel line (or at the bottom of
		// an icon's box), snapped to a whole screen pixel so glyphs map one texel to one pixel at every
		// GUI scale instead of blurring.
		float top = (Math.round((y + baseline) * scale) - PAD - ascent) / (float) scale;
		GlStateManager.translate(x, top, 0);
		GlStateManager.scale(1f / scale, 1f / scale, 1);
		Tessellator t = Tessellator.getInstance();
		WorldRenderer wr = t.getWorldRenderer();
		wr.begin(GL11.GL_QUADS, DefaultVertexFormats.POSITION_TEX);
		float pen = 0;
		for (int i = 0; i < s.length(); i++) {
			char c = s.charAt(i);
			if (c == '§') {
				i++;
				continue;
			}
			Integer g = index.get((int) c);
			if (g == null) continue;
			if (c != ' ') {
				// Snap to whole screen pixels so glyphs aren't blurred between texels.
				float gx = Math.round(pen) - PAD;
				float u1 = u[g] / (float) texW, v1 = v[g] / (float) texH;
				float u2 = (u[g] + w[g]) / (float) texW, v2 = (v[g] + cellH) / (float) texH;
				wr.pos(gx, 0, 0).tex(u1, v1).endVertex();
				wr.pos(gx, cellH, 0).tex(u1, v2).endVertex();
				wr.pos(gx + w[g], cellH, 0).tex(u2, v2).endVertex();
				wr.pos(gx + w[g], 0, 0).tex(u2, v1).endVertex();
			}
			pen += advance[g];
		}
		t.draw();
		GlStateManager.popMatrix();
		GlStateManager.color(1, 1, 1, 1);
	}

	/** Builds the glyph texture for this GUI scale, once per scale. */
	private boolean ready(int guiScale) {
		if (failed) return false;
		if (texture != null && scale == guiScale) return true;
		try {
			if (base == null) {
				InputStream in = SmoothFont.class.getResourceAsStream("/assets/novex_client/font/" + file);
				try {
					base = Font.createFont(Font.TRUETYPE_FONT, in);
				} finally {
					in.close();
				}
			}
			build(guiScale);
			return true;
		} catch (Exception e) {
			failed = true;
			return false;
		}
	}

	private void build(int guiScale) {
		Font font = base.deriveFont(size * guiScale);
		BufferedImage probe = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB);
		Graphics2D pg = probe.createGraphics();
		hints(pg);
		pg.setFont(font);
		FontMetrics fm = pg.getFontMetrics();
		int height = fm.getAscent() + fm.getDescent() + PAD * 2;
		int width = 1024, x = 0, y = 0;
		for (int i = 0; i < codepoints.length; i++) {
			String glyph = new String(Character.toChars(codepoints[i]));
			advance[i] = (float) fm.getStringBounds(glyph, pg).getWidth();
			int cw = (int) Math.ceil(advance[i]) + PAD * 2;
			if (x + cw > width) {
				x = 0;
				y += height;
			}
			u[i] = x;
			v[i] = y;
			w[i] = cw;
			x += cw;
		}
		pg.dispose();
		int h = 1;
		while (h < y + height) h <<= 1;
		BufferedImage img = new BufferedImage(width, h, BufferedImage.TYPE_INT_ARGB);
		Graphics2D g = img.createGraphics();
		hints(g);
		g.setFont(font);
		g.setColor(Color.WHITE);
		for (int i = 0; i < codepoints.length; i++) g.drawString(new String(Character.toChars(codepoints[i])), u[i] + PAD, v[i] + PAD + fm.getAscent());
		g.dispose();
		if (texture != null) texture.deleteGlTexture();
		texture = new DynamicTexture(img);
		GlStateManager.bindTexture(texture.getGlTextureId());
		GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MIN_FILTER, GL11.GL_LINEAR);
		GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MAG_FILTER, GL11.GL_LINEAR);
		scale = guiScale;
		texW = width;
		texH = h;
		cellH = height;
		ascent = fm.getAscent();
	}

	private static void hints(Graphics2D g) {
		g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
		g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
		g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
		g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
	}
}
