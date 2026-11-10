package dev.novex.client;

import dev.novex.client.core.NovexCore;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.WorldClient;
import net.minecraft.client.renderer.GlStateManager;
import net.minecraft.client.renderer.Tessellator;
import net.minecraft.client.renderer.WorldRenderer;
import net.minecraft.client.renderer.vertex.DefaultVertexFormats;
import net.minecraft.client.resources.IResource;
import net.minecraft.client.resources.IResourceManager;
import net.minecraft.util.ResourceLocation;
import org.lwjgl.opengl.GL11;
import org.lwjgl.opengl.GL12;

/**
 * Custom skies from resource packs, in the MCPatcher format: mcpatcher/sky/world0/sky1.properties and
 * up, each naming a 3x2 cube image, its fade times, how it blends and how it rotates.
 */
public final class CustomSky {
	private static final String FOLDER = "mcpatcher/sky/world0/";
	private static final int MAX_LAYERS = 32;
	private static final int DAY = 24000;

	private static List<Layer> layers;

	private CustomSky() {}

	/** Packs changed: read the sky files again on the next frame. */
	public static void reset() {
		layers = null;
	}

	private static final class Layer {
		ResourceLocation image;
		int startIn, endIn, startOut, endOut;
		String blend;
		boolean rotate;
		float x, y, z;

		/** How visible this layer is at a time of day, from 0 to 1. */
		float brightness(int time) {
			int t = wrap(time - startIn), in = wrap(endIn - startIn), hold = wrap(startOut - startIn), out = wrap(endOut - startIn);
			if (t < in) return (float) t / Math.max(1, in);
			if (t < hold) return 1f;
			if (t < out) return 1f - (float) (t - hold) / Math.max(1, out - hold);
			return 0f;
		}
	}

	private static int wrap(int ticks) {
		return ((ticks % DAY) + DAY) % DAY;
	}

	/** "18:30" as world time, where tick 0 is 6:00. */
	private static int ticks(String time) {
		String[] p = time.trim().split(":");
		return wrap(Integer.parseInt(p[0]) * 1000 + Integer.parseInt(p[1]) * 1000 / 60 - 6000);
	}

	private static List<Layer> load(IResourceManager resources) {
		List<Layer> list = new ArrayList<Layer>();
		for (int i = 1; i <= MAX_LAYERS; i++) {
			try {
				IResource file = resources.getResource(new ResourceLocation(FOLDER + "sky" + i + ".properties"));
				Properties p = new Properties();
				InputStream in = file.getInputStream();
				try {
					p.load(in);
				} finally {
					in.close();
				}
				String source = p.getProperty("source", "./sky" + i + ".png").trim();
				ResourceLocation image = new ResourceLocation(source.startsWith("./") ? FOLDER + source.substring(2) : source);
				resources.getResource(image);
				Layer l = new Layer();
				l.image = image;
				l.startIn = ticks(p.getProperty("startFadeIn"));
				l.endIn = ticks(p.getProperty("endFadeIn"));
				l.endOut = ticks(p.getProperty("endFadeOut"));
				// Without a start, the fade out takes as long as the fade in.
				l.startOut = p.getProperty("startFadeOut") != null ? ticks(p.getProperty("startFadeOut")) : wrap(l.endOut - wrap(l.endIn - l.startIn));
				l.blend = p.getProperty("blend", "add").trim();
				l.rotate = Boolean.parseBoolean(p.getProperty("rotate", "true").trim());
				String[] axis = p.getProperty("axis", "0 0 1").trim().split("\\s+");
				l.x = Float.parseFloat(axis[0]);
				l.y = Float.parseFloat(axis[1]);
				l.z = Float.parseFloat(axis[2]);
				list.add(l);
			} catch (IOException | RuntimeException e) {
				// Missing or broken layers are skipped; pack numbering often has gaps.
			}
		}
		return list;
	}

	public static void render(float partialTicks) {
		Minecraft mc = Minecraft.getMinecraft();
		WorldClient world = mc.theWorld;
		if (!NovexCore.config.customSky || world == null || world.provider.getDimensionId() != 0) return;
		if (layers == null) layers = load(mc.getResourceManager());
		if (layers.isEmpty()) return;
		int time = wrap((int) world.getWorldTime());
		float clear = 1f - world.getRainStrength(partialTicks);
		float angle = world.getCelestialAngle(partialTicks);
		GlStateManager.enableTexture2D();
		for (Layer l : layers) {
			float bright = l.brightness(time) * clear;
			if (bright <= 0.001f) continue;
			blend(l.blend, bright);
			mc.getTextureManager().bindTexture(l.image);
			GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MIN_FILTER, GL11.GL_LINEAR);
			GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MAG_FILTER, GL11.GL_LINEAR);
			GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_WRAP_S, GL12.GL_CLAMP_TO_EDGE);
			GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_WRAP_T, GL12.GL_CLAMP_TO_EDGE);
			GlStateManager.pushMatrix();
			if (l.rotate) GlStateManager.rotate(angle * 360f, l.x, l.y, -l.z);
			cube();
			GlStateManager.popMatrix();
		}
		GlStateManager.disableTexture2D();
		GlStateManager.blendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
		GlStateManager.tryBlendFuncSeparate(GL11.GL_SRC_ALPHA, GL11.GL_ONE, GL11.GL_ONE, GL11.GL_ZERO);
		GlStateManager.color(1f, 1f, 1f, 1f);
	}

	private static void blend(String mode, float b) {
		int src = GL11.GL_SRC_ALPHA, dst = GL11.GL_ONE;
		boolean byAlpha = false;
		if ("replace".equals(mode) || "alpha".equals(mode)) {
			dst = GL11.GL_ONE_MINUS_SRC_ALPHA;
			byAlpha = true;
		} else if ("multiply".equals(mode)) {
			src = GL11.GL_DST_COLOR;
			dst = GL11.GL_ONE_MINUS_SRC_ALPHA;
		} else if ("screen".equals(mode)) {
			src = GL11.GL_ONE;
			dst = GL11.GL_ONE_MINUS_SRC_COLOR;
		} else if ("dodge".equals(mode)) {
			src = GL11.GL_ONE;
		} else if ("burn".equals(mode)) {
			src = GL11.GL_ZERO;
			dst = GL11.GL_ONE_MINUS_SRC_COLOR;
		} else if ("overlay".equals(mode)) {
			src = GL11.GL_DST_COLOR;
			dst = GL11.GL_SRC_COLOR;
		}
		GlStateManager.blendFunc(src, dst);
		if (byAlpha) GlStateManager.color(1f, 1f, 1f, b);
		else GlStateManager.color(b, b, b, b);
	}

	private static void cube() {
		// Turns the cube so the image's faces line up with the world.
		GlStateManager.pushMatrix();
		GlStateManager.rotate(90f, 1f, 0f, 0f);
		GlStateManager.rotate(-90f, 0f, 0f, 1f);
		side(4);
		GlStateManager.pushMatrix();
		GlStateManager.rotate(90f, 1f, 0f, 0f);
		side(1);
		GlStateManager.popMatrix();
		GlStateManager.pushMatrix();
		GlStateManager.rotate(-90f, 1f, 0f, 0f);
		side(0);
		GlStateManager.popMatrix();
		GlStateManager.pushMatrix();
		GlStateManager.rotate(90f, 0f, 0f, 1f);
		side(5);
		GlStateManager.rotate(90f, 0f, 0f, 1f);
		side(2);
		GlStateManager.rotate(90f, 0f, 0f, 1f);
		side(3);
		GlStateManager.popMatrix();
		GlStateManager.popMatrix();
	}

	/** One tile of the image: three across, two down. */
	private static void side(int tile) {
		double u = (tile % 3) / 3d, v = (tile / 3) / 2d;
		Tessellator t = Tessellator.getInstance();
		WorldRenderer w = t.getWorldRenderer();
		w.begin(GL11.GL_QUADS, DefaultVertexFormats.POSITION_TEX);
		w.pos(-100, -100, -100).tex(u, v).endVertex();
		w.pos(-100, -100, 100).tex(u, v + 0.5).endVertex();
		w.pos(100, -100, 100).tex(u + 1 / 3d, v + 0.5).endVertex();
		w.pos(100, -100, -100).tex(u + 1 / 3d, v).endVertex();
		t.draw();
	}
}
