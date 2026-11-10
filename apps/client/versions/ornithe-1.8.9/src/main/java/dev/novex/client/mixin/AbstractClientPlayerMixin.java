package dev.novex.client.mixin;

import dev.novex.client.NovexClient;
import net.minecraft.client.entity.AbstractClientPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** FOV effects and zoom. */
@Mixin(AbstractClientPlayer.class)
abstract class AbstractClientPlayerMixin {
	@Inject(method = "getFovModifier", at = @At("RETURN"), cancellable = true)
	private void novex$fov(CallbackInfoReturnable<Float> cir) {
		cir.setReturnValue(NovexClient.fov(cir.getReturnValueF()));
	}
}
