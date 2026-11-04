package dev.novex.client;

import com.mojang.blaze3d.pipeline.RenderTarget;
import com.mojang.blaze3d.systems.RenderSystem;
import dev.novex.client.core.NovexCore;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.PostChain;
import net.minecraft.resources.ResourceLocation;

/**
 * Motion blur. This version's post chains keep their own targets between frames, so the mod holds one
 * chain and runs it after the world is drawn, the way vanilla runs its spectator effects.
 */
public final class Blur {
	private static PostChain chain;
	private static int level;
	private static int width, height;
	private static boolean failed;

	public static void render(float partialTicks) {
		Minecraft mc = Minecraft.getInstance();
		// The texture must be registered before the chain loads, since the chain looks it up then.
		if (NovexCore.config.motionBlur) MotionTexture.register();
		int want = NovexCore.config.motionBlur && mc.level != null ? NovexCore.config.motionBlurLevel : 0;
		if (want != level) close();
		if (want == 0 || failed) return;
		RenderTarget main = mc.getMainRenderTarget();
		if (chain == null) {
			try {
				chain = new PostChain(mc.getTextureManager(), mc.getResourceManager(), main, new ResourceLocation(NovexCore.ID, "shaders/post/motion_blur.json"));
			} catch (Exception e) {
				// Don't retry every frame; turning the module off and on tries again.
				failed = true;
				System.out.println("[Novex Client] Motion blur unavailable: " + e);
				return;
			}
			level = want;
			width = height = -1;
		}
		if (main.width != width || main.height != height) {
			chain.resize(main.width, main.height);
			width = main.width;
			height = main.height;
		}
		MotionTexture.update();
		RenderSystem.disableBlend();
		RenderSystem.disableDepthTest();
		RenderSystem.resetTextureMatrix();
		chain.process(partialTicks);
		main.bindWrite(true);
	}

	private static void close() {
		if (chain != null) chain.close();
		chain = null;
		level = 0;
		failed = false;
	}
}
