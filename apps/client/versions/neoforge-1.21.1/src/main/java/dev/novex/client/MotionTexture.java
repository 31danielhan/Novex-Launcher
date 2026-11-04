package dev.novex.client;

import dev.novex.client.core.MotionBlur;
import dev.novex.client.core.NovexCore;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.ResourceLocation;

/** The small texture the motion blur shader reads this frame's camera turn from (see MotionBlur). */
public final class MotionTexture {
	/** Where the blur's post effect finds it: registered over the placeholder file, which the post chain loader insists exists. */
	static final ResourceLocation ID = ResourceLocation.withDefaultNamespace("textures/effect/novex_motion.png");
	private static DynamicTexture texture;

	static void register() {
		Minecraft mc = Minecraft.getInstance();
		if (texture == null) {
			texture = new DynamicTexture(MotionBlur.WIDTH, 1, true);
			mc.getTextureManager().register(ID, texture);
		}
	}

	/** Writes this frame's camera turn. */
	public static void update() {
		Minecraft mc = Minecraft.getInstance();
		if (texture == null || mc.player == null) return;
		float aspect = (float) mc.getWindow().getWidth() / Math.max(1, mc.getWindow().getHeight());
		int[] px = MotionBlur.frame(mc.player.getYRot(), mc.player.getXRot(), mc.options.fov().get(), aspect);
		for (int i = 0; i < px.length; i++) texture.getPixels().setPixelRGBA(i, 0, MotionBlur.grey(px[i]));
		texture.upload();
	}
}
