package dev.novex.client.mixin;

import dev.novex.client.Optimizer;
import net.minecraft.client.Minecraft;
import org.lwjgl.opengl.Display;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Optimizer: lowers the frame rate while the window is in the background. */
@Mixin(Minecraft.class)
abstract class MinecraftMixin {
	@Inject(method = "getLimitFramerate", at = @At("RETURN"), cancellable = true)
	private void novex$backgroundFps(CallbackInfoReturnable<Integer> cir) {
		if (!Display.isActive() && !dev.novex.client.SelfTest.ON) cir.setReturnValue(Math.min(cir.getReturnValueI(), Optimizer.BACKGROUND_FPS));
	}
}
