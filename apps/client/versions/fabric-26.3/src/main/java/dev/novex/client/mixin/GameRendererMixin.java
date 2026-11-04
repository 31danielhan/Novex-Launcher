package dev.novex.client.mixin;

import dev.novex.client.MotionTexture;
import dev.novex.client.core.NovexCore;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.renderer.GameRenderer;
import net.minecraft.resources.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Motion blur: asks for the camera blur post effect each frame, after vanilla has added its own (spectator views). */
@Mixin(GameRenderer.class)
abstract class GameRendererMixin {
	@Inject(method = "update", at = @At("TAIL"))
	private void novex$motionBlur(DeltaTracker delta, CallbackInfo ci) {
		if (!NovexCore.config.motionBlur) return;
		MotionTexture.update();
		((GameRenderer) (Object) this).getRequestedPostEffects().add(
					Identifier.fromNamespaceAndPath(NovexCore.ID, "motion_blur"));
	}
}
