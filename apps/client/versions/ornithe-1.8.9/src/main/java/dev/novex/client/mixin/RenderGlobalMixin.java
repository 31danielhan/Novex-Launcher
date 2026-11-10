package dev.novex.client.mixin;

import dev.novex.client.CustomSky;
import net.minecraft.client.renderer.RenderGlobal;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Custom skies draw over the sky color, before the sunset, sun and moon. */
@Mixin(RenderGlobal.class)
abstract class RenderGlobalMixin {
	@Inject(method = "renderSky(FI)V", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/RenderHelper;disableStandardItemLighting()V", ordinal = 0))
	private void novex$customSky(float partialTicks, int pass, CallbackInfo ci) {
		CustomSky.render(partialTicks);
	}
}
