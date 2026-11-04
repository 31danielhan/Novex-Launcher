package dev.novex.client.mixin;

import com.mojang.blaze3d.resource.CrossFrameResourcePool;
import dev.novex.client.MotionTexture;
import dev.novex.client.core.NovexCore;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.GameRenderer;
import net.minecraft.client.renderer.LevelTargetBundle;
import net.minecraft.client.renderer.PostChain;
import net.minecraft.resources.ResourceLocation;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Motion blur: runs the blur post chain right after the world is drawn, the same way vanilla runs
 * its spectator effects. This version allows one vanilla post effect at a time, so ours runs on its own.
 */
@Mixin(GameRenderer.class)
abstract class GameRendererMixin {
	@Shadow @Final private CrossFrameResourcePool resourcePool;

	@Inject(method = "render", at = @At(value = "INVOKE",
			target = "Lnet/minecraft/client/renderer/GameRenderer;renderLevel(Lnet/minecraft/client/DeltaTracker;)V",
			shift = At.Shift.AFTER))
	private void novex$motionBlur(CallbackInfo ci) {
		if (!NovexCore.config.motionBlur) return;
		MotionTexture.update();
		Minecraft mc = Minecraft.getInstance();
		PostChain chain = mc.getShaderManager().getPostChain(
				ResourceLocation.fromNamespaceAndPath(NovexCore.ID, "motion_blur"),
				LevelTargetBundle.MAIN_TARGETS);
		if (chain != null) chain.process(mc.getMainRenderTarget(), resourcePool);
	}
}
