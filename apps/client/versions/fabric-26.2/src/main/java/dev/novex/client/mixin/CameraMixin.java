package dev.novex.client.mixin;

import dev.novex.client.core.NovexCore;
import net.minecraft.client.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Zoom narrows the camera's field of view. Sodium leaves the camera alone, so this stays compatible. */
@Mixin(Camera.class)
abstract class CameraMixin {
	// calculateFov feeds both the projection and culling each frame; getFov only reads the result.
	@Inject(method = "calculateFov", at = @At("RETURN"), cancellable = true)
	private void novex$zoom(float partialTick, CallbackInfoReturnable<Float> cir) {
		if (NovexCore.zooming) cir.setReturnValue(NovexCore.zoomedFov(cir.getReturnValue()));
	}
}
