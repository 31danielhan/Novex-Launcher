package dev.novex.client;

import dev.novex.client.core.MotionBlur;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.util.ResourceLocation;

/** The small texture the motion blur shader reads this frame's camera turn from (see MotionBlur). */
final class MotionTexture {
	/** Registered over the placeholder file, which the shader loader insists exists. */
	static final ResourceLocation ID = new ResourceLocation("textures/effect/novex_motion.png");
	private static DynamicTexture texture;

	/** Registers the texture; call before loading the blur shader, which takes its GL id. */
	static void register() {
		if (texture != null) return;
		texture = new DynamicTexture(MotionBlur.WIDTH, 1);
		Minecraft.getMinecraft().getTextureManager().loadTexture(ID, texture);
	}

	static void update() {
		Minecraft mc = Minecraft.getMinecraft();
		if (texture == null || mc.thePlayer == null) return;
		float aspect = (float) mc.displayWidth / Math.max(1, mc.displayHeight);
		int[] px = MotionBlur.frame(mc.thePlayer.rotationYaw, mc.thePlayer.rotationPitch, mc.gameSettings.fovSetting, aspect, mc.thePlayer.posX, mc.thePlayer.posY, mc.thePlayer.posZ, mc.thePlayer.isSwingInProgress || mc.thePlayer.isUsingItem());
		if (px == null) return;
		int[] data = texture.getTextureData();
		for (int i = 0; i < px.length; i++) data[i] = MotionBlur.grey(px[i]);
		texture.updateDynamicTexture();
	}
}
