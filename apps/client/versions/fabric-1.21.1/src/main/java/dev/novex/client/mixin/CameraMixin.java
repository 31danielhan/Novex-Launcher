package dev.novex.client.mixin;

import dev.novex.client.core.NovexCore;
import net.minecraft.client.Camera;
import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Zoom narrows the field of view. Sodium leaves this method alone, so it stays compatible. */
@Mixin(GameRenderer.class)
abstract class CameraMixin {
	@Inject(method = "getFov", at = @At("RETURN"), cancellable = true)
	private void novex$zoom(Camera camera, float partialTick, boolean useFovSetting, CallbackInfoReturnable<Float> cir) {
		if (NovexCore.zooming) cir.setReturnValue(NovexCore.zoomedFov(cir.getReturnValue()));
	}
}
