package dev.novex.client.mixin;

import dev.novex.client.Blur;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Motion blur runs right after the world is drawn, before vanilla's own effects and the HUD. */
@Mixin(GameRenderer.class)
abstract class GameRendererMixin {
	@Inject(method = "render", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/GameRenderer;renderLevel(Lnet/minecraft/client/DeltaTracker;)V", shift = At.Shift.AFTER))
	private void novex$motionBlur(DeltaTracker delta, boolean tick, CallbackInfo ci) {
		Blur.render(delta.getGameTimeDeltaTicks());
	}
}
