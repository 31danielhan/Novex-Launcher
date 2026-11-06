package dev.novex.client.mixin;

import dev.novex.client.core.NovexCore;
import net.minecraft.client.OptionInstance;
import net.minecraft.client.renderer.LightmapRenderStateExtractor;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.Slice;

/** Fullbright: raises the gamma the lightmap reads, without touching the saved brightness option. */
@Mixin(LightmapRenderStateExtractor.class)
abstract class FullbrightMixin {
	@Redirect(method = "extract",
			at = @At(value = "INVOKE", target = "Lnet/minecraft/client/OptionInstance;get()Ljava/lang/Object;", ordinal = 0),
			slice = @Slice(from = @At(value = "INVOKE", target = "Lnet/minecraft/client/Options;gamma()Lnet/minecraft/client/OptionInstance;")))
	private Object novex$fullbright(OptionInstance<?> gamma) {
		return NovexCore.config.fullbright ? (Object) Double.valueOf(16) : gamma.get();
	}
}
