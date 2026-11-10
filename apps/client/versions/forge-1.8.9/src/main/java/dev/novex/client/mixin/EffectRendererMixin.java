package dev.novex.client.mixin;

import dev.novex.client.Optimizer;
import net.minecraft.client.particle.EffectRenderer;
import net.minecraft.client.particle.EntityFX;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Optimizer: particles too far away to see aren't created. */
@Mixin(EffectRenderer.class)
abstract class EffectRendererMixin {
	@Inject(method = "addEffect", at = @At("HEAD"), cancellable = true)
	private void novex$skipFar(EntityFX effect, CallbackInfo ci) {
		if (Optimizer.skipParticle(effect)) ci.cancel();
	}
}
