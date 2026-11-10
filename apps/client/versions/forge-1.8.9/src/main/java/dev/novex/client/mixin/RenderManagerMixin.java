package dev.novex.client.mixin;

import dev.novex.client.Optimizer;
import net.minecraft.client.renderer.culling.ICamera;
import net.minecraft.client.renderer.entity.RenderManager;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Optimizer: skips far dropped items and XP orbs. */
@Mixin(RenderManager.class)
abstract class RenderManagerMixin {
	@Inject(method = "shouldRender", at = @At("HEAD"), cancellable = true)
	private void novex$skipFar(Entity e, ICamera camera, double x, double y, double z, CallbackInfoReturnable<Boolean> cir) {
		if (Optimizer.skipEntity(e, x, y, z)) cir.setReturnValue(false);
	}
}
