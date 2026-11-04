package dev.novex.client;

import dev.novex.client.core.MotionBlur;
import dev.novex.client.core.NovexCore;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.ResourceLocation;

/** The small texture the motion blur shader reads this frame's camera turn from (see MotionBlur). */
public final class MotionTexture {
	/** Where the blur's post effect finds it: post effects look textures up by id. */
	static final ResourceLocation ID = ResourceLocation.fromNamespaceAndPath(NovexCore.ID, "textures/effect/motion.png");
	private static DynamicTexture texture;

	/** Writes this frame's camera turn; registers the texture on first use, before the effect loads. */
	public static void update() {
		Minecraft mc = Minecraft.getInstance();
		if (texture == null) {
			texture = new DynamicTexture("Novex motion blur", MotionBlur.WIDTH, 1, true);
			mc.getTextureManager().register(ID, texture);
		}
		if (mc.player == null) return;
		float aspect = (float) mc.getWindow().getWidth() / Math.max(1, mc.getWindow().getHeight());
		int[] px = MotionBlur.frame(mc.player.getYRot(), mc.player.getXRot(), mc.options.fov().get(), aspect);
		for (int i = 0; i < px.length; i++) texture.getPixels().setPixel(i, 0, MotionBlur.grey(px[i]));
		texture.upload();
	}
}
