package dev.novex.client.mixin;

import dev.novex.client.core.NovexCore;
import net.minecraft.client.renderer.EntityRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Damage tilt off: skip the camera tilt when the player is hurt. */
@Mixin(EntityRenderer.class)
public abstract class EntityRendererMixin {
	@Inject(method = "hurtCameraEffect", at = @At("HEAD"), cancellable = true)
	private void novex$damageTilt(float partialTicks, CallbackInfo ci) {
		if (!NovexCore.config.damageTilt) ci.cancel();
	}
}
